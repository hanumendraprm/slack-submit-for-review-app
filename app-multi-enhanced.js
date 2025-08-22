require('dotenv').config();
const { App } = require('@slack/bolt');
const express = require('express');
const GoogleSheetsService = require('./googleSheets');
const GoogleDriveService = require('./googleDrive');

// Create Express app for Heroku health checks
const expressApp = express();
const port = process.env.PORT || 3000;

// Health check endpoint for Heroku
expressApp.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    apps: ['review-workflow', 'resource-request'] // Updated app names
  });
});

// App 1 Configuration (Content Review Workflow)
const reviewApp = new App({
  token: process.env.SLACK_BOT_TOKEN_APP1 || process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET_APP1 || process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN_APP1 || process.env.SLACK_APP_TOKEN
});

// App 2 Configuration (Resource Request Workflow)
const resourceApp = new App({
  token: process.env.SLACK_BOT_TOKEN_APP2,
  signingSecret: process.env.SLACK_SIGNING_SECRET_APP2,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN_APP2
});

// App-specific configurations
const reviewConfig = {
  channelId: process.env.CHANNEL_ID_APP1 || process.env.CHANNEL_ID || null,
  channelName: process.env.CHANNEL_NAME_APP1 || process.env.CHANNEL_NAME,
  googleSheetId: process.env.GOOGLE_SHEET_ID_APP1 || process.env.GOOGLE_SHEET_ID,
  googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_APP1 || process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  appName: 'Review Workflow'
};

const resourceConfig = {
  channelId: process.env.CHANNEL_ID_APP2 || null,
  channelName: process.env.CHANNEL_NAME_APP2,
  googleSheetId: process.env.GOOGLE_SHEET_ID_APP2,
  googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_APP2,
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID_APP2,
  appName: 'Resource Request'
};

// Initialize services
const googleSheets1 = new GoogleSheetsService();
const googleSheets2 = new GoogleSheetsService();
const googleDrive = new GoogleDriveService();

/**
 * Validate required environment variables for an app
 */
function validateAppEnvironment(appConfig, appName) {
  const required = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_APP_TOKEN'];
  const missing = required.filter(key => !process.env[`${key}_${appName.toUpperCase().replace(' ', '')}`] && !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for ${appName}: ${missing.join(', ')}`);
  }
  
  if (!appConfig.channelId && !appConfig.channelName) {
    throw new Error(`Either CHANNEL_ID_${appName.toUpperCase().replace(' ', '')} or CHANNEL_NAME_${appName.toUpperCase().replace(' ', '')} must be set for ${appName}`);
  }

  // Check Google Sheets configuration
  if (!appConfig.googleSheetId) {
    console.warn(`⚠️  GOOGLE_SHEET_ID_${appName.toUpperCase().replace(' ', '')} not set - Google Sheets integration will be disabled for ${appName}`);
  }
  if (!appConfig.googleServiceAccountKey) {
    console.warn(`⚠️  GOOGLE_SERVICE_ACCOUNT_KEY_${appName.toUpperCase().replace(' ', '')} not set - Google Sheets integration will be disabled for ${appName}`);
  }
}

/**
 * Resolve private channel ID by name for a specific app
 */
async function ensureChannelId(client, appConfig, appName) {
  if (appConfig.channelId) return appConfig.channelId;
  if (!appConfig.channelName) {
    throw new Error(`Set CHANNEL_NAME_${appName.toUpperCase().replace(' ', '')} or CHANNEL_ID_${appName.toUpperCase().replace(' ', '')} in .env`);
  }

  try {
    // First try to get the channel directly by name
    try {
      const res = await client.conversations.list({
        types: 'private_channel',
        limit: 1000
      });
      
      const match = (res.channels || []).find(
        ch => ch.name === appConfig.channelName
      );
      
      if (match) {
        appConfig.channelId = match.id;
        return appConfig.channelId;
      }
    } catch (listError) {
      console.error(`Error listing conversations for ${appName}:`, listError);
    }

    // If not found, try to join the channel by name
    try {
      const joinRes = await client.conversations.join({
        channel: appConfig.channelName
      });
      
      if (joinRes.ok && joinRes.channel) {
        appConfig.channelId = joinRes.channel.id;
        return appConfig.channelId;
      }
    } catch (joinError) {
      console.error(`Error joining channel for ${appName}:`, joinError);
    }

    // If all else fails, throw error
    throw new Error(
      `Could not find or join private channel named #${appConfig.channelName} for ${appName}. ` +
      `Ensure the app is installed and invited to the channel.`
    );
  } catch (error) {
    console.error(`Error resolving channel ID for ${appName}:`, error);
    throw error;
  }
}

/**
 * Initialize Google Sheets for a specific app
 */
async function initializeGoogleSheets(googleSheets, appConfig, appName) {
  if (!appConfig.googleSheetId || !appConfig.googleServiceAccountKey) {
    console.warn(`⚠️ Google Sheets integration disabled for ${appName} - set GOOGLE_SHEET_ID_${appName.toUpperCase().replace(' ', '')} and GOOGLE_SERVICE_ACCOUNT_KEY_${appName.toUpperCase().replace(' ', '')} to enable`);
    return false;
  }

  try {
    await googleSheets.initialize(appConfig.googleSheetId, appConfig.googleServiceAccountKey);
    console.log(`📊 Google Sheets integration enabled for ${appName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to initialize Google Sheets for ${appName}:`, error);
    return false;
  }
}

/**
 * Initialize Google Drive for resource requests
 */
async function initializeGoogleDrive(appConfig, appName) {
  if (!appConfig.googleDriveFolderId || !appConfig.googleServiceAccountKey) {
    console.warn(`⚠️ Google Drive integration disabled for ${appName} - set GOOGLE_DRIVE_FOLDER_ID_${appName.toUpperCase().replace(' ', '')} and GOOGLE_SERVICE_ACCOUNT_KEY_${appName.toUpperCase().replace(' ', '')} to enable`);
    return false;
  }

  try {
    await googleDrive.initialize(appConfig.googleServiceAccountKey, appConfig.googleDriveFolderId);
    console.log(`📁 Google Drive integration enabled for ${appName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to initialize Google Drive for ${appName}:`, error);
    return false;
  }
}

// ===== REVIEW WORKFLOW (APP 1) EVENT HANDLERS =====

// Review App: Submit for Review shortcut
reviewApp.shortcut('submit_for_review', async ({ shortcut, ack, client }) => {
  await ack();
  
  try {
    const channelId = await ensureChannelId(client, reviewConfig, 'Review Workflow');
    
    const modalView = {
      type: 'modal',
      callback_id: 'submit_for_review_modal',
      title: {
        type: 'plain_text',
        text: 'Submit for Review',
        emoji: true
      },
      submit: {
        type: 'plain_text',
        text: 'Submit',
        emoji: true
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
        emoji: true
      },
      blocks: [
        {
          type: 'input',
          block_id: 'asset_code',
          label: {
            type: 'plain_text',
            text: 'Asset Code',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'asset_code_input',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., GW1',
              emoji: true
            }
          }
        },
        {
          type: 'actions',
          block_id: 'fetch_details',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Fetch Details',
                emoji: true
              },
              action_id: 'fetch_details_btn',
              style: 'primary'
            }
          ]
        },
        {
          type: 'input',
          block_id: 'topic',
          label: {
            type: 'plain_text',
            text: 'Topic',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'topic_input',
            placeholder: {
              type: 'plain_text',
              text: 'Automatically Fetched: Topic of the Asset',
              emoji: true
            }
          }
        },
        {
          type: 'input',
          block_id: 'asset_name',
          label: {
            type: 'plain_text',
            text: 'Asset Name',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'asset_name_input',
            placeholder: {
              type: 'plain_text',
              text: 'Automatically Fetched LinkedIn Post etc.',
              emoji: true
            }
          }
        },
        {
          type: 'input',
          block_id: 'draft_link',
          label: {
            type: 'plain_text',
            text: 'Draft Link',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'draft_link_input',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., https://docs.google.com/document/d/...',
              emoji: true
            }
          }
        },
        {
          type: 'input',
          block_id: 'additional_notes',
          label: {
            type: 'plain_text',
            text: 'Additional Notes',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'additional_notes_input',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Any additional notes or comments...',
              emoji: true
            }
          },
          optional: true
        }
      ]
    };

    await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: modalView
    });
  } catch (error) {
    console.error('Error opening review modal:', error);
  }
});

// ===== RESOURCE REQUEST (APP 2) EVENT HANDLERS =====

// Resource App: Request for Resource shortcut
resourceApp.shortcut('request_for_resource', async ({ shortcut, ack, client }) => {
  await ack();
  
  try {
    const channelId = await ensureChannelId(client, resourceConfig, 'Resource Request');
    
    const modalView = {
      type: 'modal',
      callback_id: 'request_for_resource_modal',
      title: {
        type: 'plain_text',
        text: 'Request for Resource',
        emoji: true
      },
      submit: {
        type: 'plain_text',
        text: 'Submit Request',
        emoji: true
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
        emoji: true
      },
      blocks: [
        {
          type: 'input',
          block_id: 'asset_code',
          label: {
            type: 'plain_text',
            text: 'Asset Code',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'asset_code_input',
            placeholder: {
              type: 'plain_text',
              text: 'e.g., GW1',
              emoji: true
            }
          }
        },
        {
          type: 'actions',
          block_id: 'fetch_details',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Fetch Details',
                emoji: true
              },
              action_id: 'fetch_details_btn_resource',
              style: 'primary'
            }
          ]
        },
        {
          type: 'input',
          block_id: 'topic',
          label: {
            type: 'plain_text',
            text: 'Topic',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'topic_input',
            placeholder: {
              type: 'plain_text',
              text: 'Automatically Fetched: Topic of the Asset',
              emoji: true
            }
          }
        },
        {
          type: 'input',
          block_id: 'asset_name',
          label: {
            type: 'plain_text',
            text: 'Asset Name',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'asset_name_input',
            placeholder: {
              type: 'plain_text',
              text: 'Automatically Fetched LinkedIn Post etc.',
              emoji: true
            }
          }
        },
        {
          type: 'input',
          block_id: 'resource_required',
          label: {
            type: 'plain_text',
            text: 'Resource Required',
            emoji: true
          },
          element: {
            type: 'static_select',
            action_id: 'resource_type_select',
            placeholder: {
              type: 'plain_text',
              text: 'Select resource type',
              emoji: true
            },
            options: [
              {
                text: {
                  type: 'plain_text',
                  text: 'Video',
                  emoji: true
                },
                value: 'Video'
              },
              {
                text: {
                  type: 'plain_text',
                  text: 'Image',
                  emoji: true
                },
                value: 'Image'
              },
              {
                text: {
                  type: 'plain_text',
                  text: 'Document',
                  emoji: true
                },
                value: 'Document'
              }
            ]
          }
        },
        {
          type: 'input',
          block_id: 'additional_comments',
          label: {
            type: 'plain_text',
            text: 'Additional Comments',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'additional_comments_input',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Any additional comments or specifications...',
              emoji: true
            }
          },
          optional: true
        }
      ]
    };

    await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: modalView
    });
  } catch (error) {
    console.error('Error opening resource request modal:', error);
  }
});

// ===== REVIEW WORKFLOW (APP 1) EVENT HANDLERS =====

// Review App: Fetch Details button
reviewApp.action('fetch_details_btn', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const assetCode = body.view?.state?.values?.asset_code?.asset_code_input?.value;
    
    if (!assetCode || assetCode.trim() === '') {
      await client.views.update({
        view_id: body.view.id,
        view: {
          ...body.view,
          blocks: body.view.blocks.map(block => {
            if (block.block_id === 'fetch_details') {
              return {
                ...block,
                elements: [{
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Please enter an Asset Code first, then click "Fetch Details".',
                    emoji: true
                  },
                  action_id: 'fetch_details_btn',
                  style: 'danger'
                }]
              };
            }
            return block;
          })
        }
      });
      return;
    }

    // Fetch asset details from Google Sheets
    const asset = await googleSheets1.getAssetByCode(assetCode.trim());
    
    if (!asset) {
      await client.views.update({
        view_id: body.view.id,
        view: {
          ...body.view,
          blocks: body.view.blocks.map(block => {
            if (block.block_id === 'fetch_details') {
              return {
                ...block,
                elements: [{
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Asset not found. Please check the Asset Code.',
                    emoji: true
                  },
                  action_id: 'fetch_details_btn',
                  style: 'danger'
                }]
              };
            }
            return block;
          })
        }
      });
      return;
    }

    // Update the modal with fetched details
    const updatedBlocks = body.view.blocks.map(block => {
      if (block.block_id === 'topic') {
        return {
          ...block,
          element: {
            ...block.element,
            initial_value: asset.topic || ''
          }
        };
      }
      if (block.block_id === 'asset_name') {
        return {
          ...block,
          element: {
            ...block.element,
            initial_value: asset.assetName || ''
          }
        };
      }
      if (block.block_id === 'fetch_details') {
        return {
          ...block,
          elements: [{
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✅ Details fetched successfully!',
              emoji: true
            },
            action_id: 'fetch_details_btn',
            style: 'primary'
          }]
        };
      }
      return block;
    });

    await client.views.update({
      view_id: body.view.id,
      view: {
        ...body.view,
        blocks: updatedBlocks
      }
    });
  } catch (error) {
    console.error('Error fetching details for review app:', error);
  }
});

// ===== RESOURCE REQUEST (APP 2) EVENT HANDLERS =====

// Resource App: Fetch Details button
resourceApp.action('fetch_details_btn_resource', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const assetCode = body.view?.state?.values?.asset_code?.asset_code_input?.value;
    
    if (!assetCode || assetCode.trim() === '') {
      await client.views.update({
        view_id: body.view.id,
        view: {
          ...body.view,
          blocks: body.view.blocks.map(block => {
            if (block.block_id === 'fetch_details') {
              return {
                ...block,
                elements: [{
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Please enter an Asset Code first, then click "Fetch Details".',
                    emoji: true
                  },
                  action_id: 'fetch_details_btn_resource',
                  style: 'danger'
                }]
              };
            }
            return block;
          })
        }
      });
      return;
    }

    // Fetch asset details from Google Sheets
    const asset = await googleSheets2.getAssetByCode(assetCode.trim());
    
    if (!asset) {
      await client.views.update({
        view_id: body.view.id,
        view: {
          ...body.view,
          blocks: body.view.blocks.map(block => {
            if (block.block_id === 'fetch_details') {
              return {
                ...block,
                elements: [{
                  type: 'button',
                  text: {
                    type: 'plain_text',
                    text: 'Asset not found. Please check the Asset Code.',
                    emoji: true
                  },
                  action_id: 'fetch_details_btn_resource',
                  style: 'danger'
                }]
              };
            }
            return block;
          })
        }
      });
      return;
    }

    // Update the modal with fetched details
    const updatedBlocks = body.view.blocks.map(block => {
      if (block.block_id === 'topic') {
        return {
          ...block,
          element: {
            ...block.element,
            initial_value: asset.topic || ''
          }
        };
      }
      if (block.block_id === 'asset_name') {
        return {
          ...block,
          element: {
            ...block.element,
            initial_value: asset.assetName || ''
          }
        };
      }
      if (block.block_id === 'fetch_details') {
        return {
          ...block,
          elements: [{
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✅ Details fetched successfully!',
              emoji: true
            },
            action_id: 'fetch_details_btn_resource',
            style: 'primary'
          }]
        };
      }
      return block;
    });

    await client.views.update({
      view_id: body.view.id,
      view: {
        ...body.view,
        blocks: updatedBlocks
      }
    });
  } catch (error) {
    console.error('Error fetching details for resource app:', error);
  }
});

// Start both apps
  try {
    // Validate environment for both apps
    validateAppEnvironment(reviewConfig, 'Review Workflow');
    validateAppEnvironment(resourceConfig, 'Resource Request');

    // Initialize Google Sheets for both apps
    await initializeGoogleSheets(googleSheets1, reviewConfig, 'Review Workflow');
    await initializeGoogleSheets(googleSheets2, resourceConfig, 'Resource Request');

    // Initialize Google Drive for resource requests
    await initializeGoogleDrive(resourceConfig, 'Resource Request');

    // Start Review App
    await reviewApp.start();
    console.log('⚡️ Review Workflow is running with Socket Mode');

    // Start Resource App
    await resourceApp.start();
    console.log('⚡️ Resource Request is running with Socket Mode');

    // Start Express server for Heroku
    expressApp.listen(port, () => {
      console.log('🚀 Express server started on port', port);
      console.log('📋 Running 2 Slack apps on single dyno');
      console.log(`📋 Review Workflow channel: ${reviewConfig.channelName || reviewConfig.channelId}`);
      console.log(`📋 Resource Request channel: ${resourceConfig.channelName || resourceConfig.channelId}`);
    });
  } catch (error) {
    console.error('Error starting apps:', error);
    process.exit(1);
  }
}

startApps();

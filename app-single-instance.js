require('dotenv').config();
const { App } = require('@slack/bolt');
const express = require('express');
const GoogleSheetsService = require('./googleSheets');
const GoogleDriveService = require('./googleDrive');

// Initialize Google Drive service
const googleDrive = new GoogleDriveService();

// Create Express app for Heroku health checks
const expressApp = express();
const port = process.env.PORT || 3000;

// Health check endpoint for Heroku
expressApp.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    apps: ['review-workflow', 'resource-request']
  });
});

// Single Slack App Instance (using App 1's credentials)
const app = new App({
  token: process.env.SLACK_BOT_TOKEN_APP1 || process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET_APP1 || process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN_APP1 || process.env.SLACK_APP_TOKEN
});

// App configurations
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

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const required = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_APP_TOKEN'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (!reviewConfig.channelId && !reviewConfig.channelName) {
    throw new Error('Either CHANNEL_ID_APP1 or CHANNEL_NAME_APP1 must be set');
  }

  if (!resourceConfig.channelId && !resourceConfig.channelName) {
    throw new Error('Either CHANNEL_ID_APP2 or CHANNEL_NAME_APP2 must be set');
  }
}

/**
 * Resolve private channel ID by name
 */
async function ensureChannelId(client, config, appName) {
  if (config.channelId) return config.channelId;
  if (!config.channelName) {
    throw new Error(`Set CHANNEL_NAME for ${appName}`);
  }

  try {
    const res = await client.conversations.list({
      types: 'private_channel',
      limit: 1000
    });
    
    const match = (res.channels || []).find(
      channel => channel.name === config.channelName
    );
    
    if (match) {
      console.log(`✅ Found channel '${config.channelName}' for ${appName}: ${match.id}`);
      return match.id;
    }
    
    throw new Error(`Channel '${config.channelName}' not found for ${appName}`);
  } catch (error) {
    console.error(`❌ Error resolving channel for ${appName}:`, error);
    throw error;
  }
}

/**
 * Initialize Google Sheets service
 */
async function initializeGoogleSheets(service, config, appName) {
  if (!config.googleSheetId || !config.googleServiceAccountKey) {
    console.warn(`⚠️  Google Sheets integration disabled for ${appName}`);
    return false;
  }

  try {
    await service.initialize(config.googleSheetId, config.googleServiceAccountKey);
    console.log(`📊 Google Sheets integration enabled for ${appName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to initialize Google Sheets for ${appName}:`, error);
    return false;
  }
}

/**
 * Initialize Google Drive service
 */
async function initializeGoogleDrive(config, appName) {
  if (!config.googleDriveFolderId || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.warn(`⚠️  Google Drive integration disabled for ${appName} - missing folder ID or service account key`);
    return false;
  }

  try {
    // Check if service account key is valid JSON
    let serviceAccountKey;
    try {
      serviceAccountKey = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    } catch (jsonError) {
      console.error('❌ Invalid Google Service Account Key format:', jsonError.message);
      console.warn(`⚠️  Google Drive integration disabled for ${appName} - invalid service account key`);
      return false;
    }

    await googleDrive.initialize(serviceAccountKey, config.googleDriveFolderId);
    console.log(`📁 Google Drive service initialized`);
    console.log(`📁 Target folder ID: ${config.googleDriveFolderId}`);
    console.log(`📁 Google Drive integration enabled for ${appName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to initialize Google Drive for ${appName}:`, error);
    return false;
  }
}

// ===== REVIEW WORKFLOW EVENT HANDLERS =====

// Submit for Review shortcut
app.shortcut('submit_for_review', async ({ shortcut, ack, client }) => {
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
              text: 'https://...',
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
          }
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

// Fetch Details button for Review
app.action('fetch_details_btn', async ({ ack, body, client }) => {
  console.log('🎯 Fetch Details button clicked for Review workflow');
  try {

    
    // Check if body.view and body.view.state exist
    if (!body.view || !body.view.state || !body.view.state.values) {
      console.error('body.view.state.values is undefined');
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: '❌ Error: Unable to read form data. Please try again.'
      });
      return;
    }
    
    const assetCode = body.view.state.values.asset_code?.asset_code_input?.value;
    
    if (!assetCode) {
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: '❌ Please enter an Asset Code first.'
      });
      return;
    }

    const asset = await googleSheets1.getAssetByCode(assetCode);
    
    if (!asset) {
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: `❌ Asset with code '${assetCode}' not found.`
      });
      return;
    }

    // Update the modal with fetched data using views.update
    console.log('🔄 Attempting to update Review modal with views.update');
    await ack();
    
    // Store fetched data in private_metadata for form submission
    const fetchedData = JSON.stringify({
      topic: asset['Topic'] || '',
      assetName: asset['Asset Name'] || ''
    });
    
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "submit_for_review_modal",
        private_metadata: fetchedData,
        title: {
          type: "plain_text",
          text: "Submit for Review",
          emoji: true
        },
        submit: {
          type: "plain_text",
          text: "Submit",
          emoji: true
        },
        close: {
          type: "plain_text",
          text: "Cancel",
          emoji: true
        },
        blocks: [
          {
            type: "input",
            block_id: "asset_code",
            label: {
              type: "plain_text",
              text: "Asset Code",
              emoji: true
            },
            element: {
              type: "plain_text_input",
              action_id: "asset_code_input",
              initial_value: assetCode,
              placeholder: {
                type: "plain_text",
                text: "e.g., GW1",
                emoji: true
              }
            }
          },
          {
            type: "actions",
            block_id: "fetch_details",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Fetch Details",
                  emoji: true
                },
                action_id: "fetch_details_btn",
                style: "primary"
              }
            ]
          },
          {
            type: "input",
            block_id: "topic",
            label: {
              type: "plain_text",
              text: "Topic",
              emoji: true
            },
            element: {
              type: "plain_text_input",
              action_id: "topic_input",
              initial_value: asset['Topic'] || '',
              placeholder: {
                type: "plain_text",
                text: "Automatically Fetched: Topic of the Asset",
                emoji: true
              }
            }
          },
          {
            type: "input",
            block_id: "asset_name",
            label: {
              type: "plain_text",
              text: "Asset Name",
              emoji: true
            },
            element: {
              type: "plain_text_input",
              action_id: "asset_name_input",
              initial_value: asset['Asset Name'] || '',
              placeholder: {
                type: "plain_text",
                text: "Automatically Fetched LinkedIn Post etc.",
                emoji: true
              }
            }
          },
          {
            type: "input",
            block_id: "draft_link",
            label: {
              type: "plain_text",
              text: "Draft Link",
              emoji: true
            },
            element: {
              type: "plain_text_input",
              action_id: "draft_link_input",
              placeholder: {
                type: "plain_text",
                text: "https://...",
                emoji: true
              }
            }
          },
          {
            type: "input",
            block_id: "additional_notes",
            label: {
              type: "plain_text",
              text: "Additional Notes",
              emoji: true
            },
            element: {
              type: "plain_text_input",
              action_id: "additional_notes_input",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "Any additional notes or comments...",
                emoji: true
              }
            }
          }
        ]
      }
    });


  } catch (error) {
    console.error('Error fetching asset details:', error);
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: '❌ Error fetching asset details. Please try again.'
    });
  }
});

// Submit for Review modal submission
app.view('submit_for_review_modal', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const values = body.view.state.values;
    let assetCode = values.asset_code.asset_code_input.value;
    const draftLink = values.draft_link.draft_link_input.value;
    const additionalNotes = values.additional_notes.additional_notes_input.value;
    
    // Get topic and asset name from form values or private_metadata
    let topic = values.topic.topic_input.value;
    let assetName = values.asset_name.asset_name_input.value;
    
    // If form values are empty, try to get from private_metadata
    if (!assetCode || !topic || !assetName) {
      try {
        const fetchedData = JSON.parse(body.view.private_metadata || '{}');
        assetCode = assetCode || fetchedData.assetCode || '';
        topic = topic || fetchedData.topic || 'N/A';
        assetName = assetName || fetchedData.assetName || 'N/A';
      } catch (error) {
        console.error('Error parsing private_metadata:', error);
        assetCode = assetCode || '';
        topic = topic || 'N/A';
        assetName = assetName || 'N/A';
      }
    }

    if (!assetCode) {
      throw new Error('Asset Code is required');
    }

    const channelId = await ensureChannelId(client, reviewConfig, 'Review Workflow');

    // Update Google Sheets
    if (googleSheets1.auth) {
      await googleSheets1.updateAssetStatus(assetCode, draftLink);
    }

    // Post message to channel
    const message = {
      channel: channelId,
      text: `📋 *SUBMIT FOR REVIEW*\n\n*Code:* ${assetCode}\n*Topic:* ${topic || 'N/A'}\n*Asset Name:* ${assetName || 'N/A'}\n*Draft Link:* ${draftLink || 'N/A'}\n${additionalNotes ? `*Additional Notes:* ${additionalNotes}` : ''}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📋 SUBMIT FOR REVIEW',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Code:*\n${assetCode}`
            },
            {
              type: 'mrkdwn',
              text: `*Topic:*\n${topic || 'N/A'}`
            }
          ]
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Asset Name:*\n${assetName || 'N/A'}`
            },
            {
              type: 'mrkdwn',
              text: `*Draft Link:*\n${draftLink || 'N/A'}`
            }
          ]
        },
        ...(additionalNotes ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Additional Notes:*\n${additionalNotes}`
          }
        }] : []),
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Approve',
                emoji: true
              },
              action_id: 'approve_btn',
              style: 'primary',
              value: assetCode
            },
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Need Changes',
                emoji: true
              },
              action_id: 'need_changes_btn',
              style: 'danger',
              value: assetCode
            }
          ]
        }
      ]
    };

    await client.chat.postMessage(message);

    // Send ephemeral message to user
    await client.chat.postEphemeral({
      channel: channelId,
      user: body.user.id,
      text: '✅ Your submission has been posted to the channel for review.'
    });

  } catch (error) {
    console.error('Error handling review submission:', error);
    await ack({
      response_action: 'errors',
      errors: {
        asset_code: 'An error occurred. Please try again.'
      }
    });
  }
});

// ===== RESOURCE REQUEST EVENT HANDLERS =====

// Request for Resource shortcut
app.shortcut('request_for_resource', async ({ shortcut, ack, client }) => {
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
          block_id: 'resource_type',
          label: {
            type: 'plain_text',
            text: 'Resource Required',
            emoji: true
          },
          element: {
            type: 'static_select',
            action_id: 'resource_type_input',
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
              text: 'Any additional comments or requirements...',
              emoji: true
            }
          }
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

// Fetch Details button for Resource Request
app.action('fetch_details_btn_resource', async ({ ack, body, client }) => {
  console.log('🎯 Fetch Details button clicked for Resource Request workflow');
  try {

    
    // Check if body.view and body.view.state exist
    if (!body.view || !body.view.state || !body.view.state.values) {
      console.error('body.view.state.values is undefined');
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: '❌ Error: Unable to read form data. Please try again.'
      });
      return;
    }
    
    const assetCode = body.view.state.values.asset_code?.asset_code_input?.value;
    
    if (!assetCode) {
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: '❌ Please enter an Asset Code first.'
      });
      return;
    }

    const asset = await googleSheets2.getAssetByCode(assetCode);
    
    if (!asset) {
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: `❌ Asset with code '${assetCode}' not found.`
      });
      return;
    }

    // Update the modal with fetched data using views.update
    console.log('🔄 Attempting to update Resource Request modal with views.update');
    await ack();
    
    // Store fetched data in private_metadata for form submission
    const fetchedData = JSON.stringify({
      topic: asset['Topic'] || '',
      assetName: asset['Asset Name'] || ''
    });
    
    await client.views.update({
      view_id: body.view.id,
      view: {
        type: "modal",
        callback_id: "request_for_resource_modal",
        private_metadata: fetchedData,
        title: {
          type: "plain_text",
          text: "Request for Resource",
          emoji: true
        },
        submit: {
          type: "plain_text",
          text: "Submit Request",
          emoji: true
        },
        close: {
          type: "plain_text",
          text: "Cancel",
          emoji: true
        },
        blocks: [
          {
            type: "input",
            block_id: "asset_code",
            label: {
              type: "plain_text",
              text: "Asset Code",
              emoji: true
            },
            element: {
              type: "plain_text_input",
              action_id: "asset_code_input",
              initial_value: assetCode,
              placeholder: {
                type: "plain_text",
                text: "e.g., GW1",
                emoji: true
              }
            }
          },
          {
            type: "actions",
            block_id: "fetch_details",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "Fetch Details",
                  emoji: true
                },
                action_id: "fetch_details_btn_resource",
                style: "primary"
              }
            ]
          },
          {
            type: "input",
            block_id: "topic",
            label: {
              type: "plain_text",
              text: "Topic",
              emoji: true
            },
            element: {
              type: "plain_text_input",
              action_id: "topic_input",
              initial_value: asset['Topic'] || '',
              placeholder: {
                type: "plain_text",
                text: "Automatically Fetched: Topic of the Asset",
                emoji: true
              }
            }
          },
          {
            type: "input",
            block_id: "asset_name",
            label: {
              type: "plain_text",
              text: "Asset Name",
              emoji: true
            },
            element: {
              type: "plain_text_input",
              action_id: "asset_name_input",
              initial_value: asset['Asset Name'] || '',
              placeholder: {
                type: "plain_text",
                text: "Automatically Fetched LinkedIn Post etc.",
                emoji: true
              }
            }
          },
          {
            type: "input",
            block_id: "resource_type",
            label: {
              type: "plain_text",
              text: "Resource Required",
              emoji: true
            },
            element: {
              type: "static_select",
              action_id: "resource_type_input",
              placeholder: {
                type: "plain_text",
                text: "Select resource type",
                emoji: true
              },
              options: [
                {
                  text: {
                    type: "plain_text",
                    text: "Video",
                    emoji: true
                  },
                  value: "Video"
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Image",
                    emoji: true
                  },
                  value: "Image"
                },
                {
                  text: {
                    type: "plain_text",
                    text: "Document",
                    emoji: true
                  },
                  value: "Document"
                }
              ]
            }
          },
          {
            type: "input",
            block_id: "additional_comments",
            label: {
              type: "plain_text",
              text: "Additional Comments",
              emoji: true
            },
            element: {
              type: "plain_text_input",
              action_id: "additional_comments_input",
              multiline: true,
              placeholder: {
                type: "plain_text",
                text: "Any additional comments or requirements...",
                emoji: true
              }
            }
          }
        ]
      }
    });
    


  } catch (error) {
    console.error('Error fetching asset details for resource request:', error);
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: '❌ Error fetching asset details. Please try again.'
    });
  }
});

// Request for Resource modal submission
app.view('request_for_resource_modal', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const values = body.view.state.values;
    const assetCode = values.asset_code.asset_code_input.value;
    const resourceType = values.resource_type.resource_type_input.selected_option?.value;
    const additionalComments = values.additional_comments.additional_comments_input.value;
    
    // Get topic and asset name from form values or private_metadata
    let topic = values.topic.topic_input.value;
    let assetName = values.asset_name.asset_name_input.value;
    
    // If form values are empty, try to get from private_metadata
    if (!topic || !assetName) {
      try {
        const fetchedData = JSON.parse(body.view.private_metadata || '{}');
        topic = topic || fetchedData.topic || 'N/A';
        assetName = assetName || fetchedData.assetName || 'N/A';
      } catch (error) {
        console.error('Error parsing private_metadata:', error);
        topic = topic || 'N/A';
        assetName = assetName || 'N/A';
      }
    }

    if (!assetCode) {
      throw new Error('Asset Code is required');
    }

    if (!resourceType) {
      throw new Error('Resource Type is required');
    }

    const channelId = await ensureChannelId(client, resourceConfig, 'Resource Request');

    // Post message to channel
    const message = {
      channel: channelId,
      text: `📋 *REQUEST FOR RESOURCE*\n\n*Code:* ${assetCode}\n*Topic:* ${topic || 'N/A'}\n*Asset Name:* ${assetName || 'N/A'}\n*Resource(s) Required:* ${resourceType}\n${additionalComments ? `*Notes:* ${additionalComments}` : ''}\n\n<@garry.woodford> - Please provide the requested resource.`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📋 REQUEST FOR RESOURCE',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Code:*\n${assetCode}`
            },
            {
              type: 'mrkdwn',
              text: `*Topic:*\n${topic || 'N/A'}`
            }
          ]
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Asset Name:*\n${assetName || 'N/A'}`
            },
            {
              type: 'mrkdwn',
              text: `*Resource(s) Required:*\n${resourceType}`
            }
          ]
        },
        ...(additionalComments ? [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Notes:*\n${additionalComments}`
          }
        }] : []),
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '<@garry.woodford> - Please provide the requested resource.'
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Upload Resource',
                emoji: true
              },
              action_id: 'upload_resource_btn',
              style: 'primary',
              value: JSON.stringify({
                assetCode,
                topic: topic || '',
                assetName: assetName || '',
                resourceType
              })
            }
          ]
        }
      ]
    };

    await client.chat.postMessage(message);

    // Send ephemeral message to user
    await client.chat.postEphemeral({
      channel: channelId,
      user: body.user.id,
      text: '✅ Your resource request has been posted to the channel.'
    });

  } catch (error) {
    console.error('Error handling resource request submission:', error);
    await ack({
      response_action: 'errors',
      errors: {
        asset_code: 'An error occurred. Please try again.'
      }
    });
  }
});

// ===== SHARED EVENT HANDLERS =====

// Approve button handler
app.action('approve_btn', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const assetCode = body.actions[0].value;
    
    // Open approval modal
    const modalView = {
      type: 'modal',
      callback_id: 'approve_modal',
      private_metadata: JSON.stringify({
        assetCode,
        channelId: body.channel.id,
        messageTs: body.message.ts
      }),
      title: {
        type: 'plain_text',
        text: 'Approve Asset',
        emoji: true
      },
      submit: {
        type: 'plain_text',
        text: 'Approve',
        emoji: true
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
        emoji: true
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Asset Code:* ${assetCode}\n\nPlease add any additional comments for this approval:`
          }
        },
        {
          type: 'input',
          block_id: 'approval_comments',
          label: {
            type: 'plain_text',
            text: 'Additional Comments',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'approval_comments_input',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Any additional comments or feedback...',
              emoji: true
            }
          }
        }
      ]
    };

    await client.views.open({
      trigger_id: body.trigger_id,
      view: modalView
    });

  } catch (error) {
    console.error('Error opening approval modal:', error);
  }
});

// Need Changes button handler
app.action('need_changes_btn', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const assetCode = body.actions[0].value;
    
    // Get asset details from Google Sheets
    let assetDetails = {};
    if (googleSheets1.auth) {
      try {
        assetDetails = await googleSheets1.getAssetByCode(assetCode);
      } catch (error) {
        console.error('Error fetching asset details:', error);
      }
    }
    
    // Open need changes modal
    const modalView = {
      type: 'modal',
      callback_id: 'need_changes_modal',
      private_metadata: JSON.stringify({
        assetCode,
        channelId: body.channel.id,
        messageTs: body.message.ts,
        topic: assetDetails['Topic'] || 'N/A',
        assetName: assetDetails['Asset Name'] || 'N/A'
      }),
      title: {
        type: 'plain_text',
        text: 'Request Changes',
        emoji: true
      },
      submit: {
        type: 'plain_text',
        text: 'Submit Feedback',
        emoji: true
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
        emoji: true
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Asset Details:*\n• *Code:* ${assetCode}\n• *Topic:* ${assetDetails['Topic'] || 'N/A'}\n• *Asset Name:* ${assetDetails['Asset Name'] || 'N/A'}`
          }
        },
        {
          type: 'input',
          block_id: 'feedback_comments',
          label: {
            type: 'plain_text',
            text: 'Feedback & Changes Required',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'feedback_comments_input',
            multiline: true,
            placeholder: {
              type: 'plain_text',
              text: 'Please describe the changes needed...',
              emoji: true
            }
          }
        }
      ]
    };

    await client.views.open({
      trigger_id: body.trigger_id,
      view: modalView
    });

  } catch (error) {
    console.error('Error opening need changes modal:', error);
  }
});

// Approve modal submission
app.view('approve_modal', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const values = body.view.state.values;
    const additionalComments = values.approval_comments?.approval_comments_input?.value || '';
    
    // Get data from private_metadata
    const data = JSON.parse(body.view.private_metadata);
    const { assetCode, channelId, messageTs } = data;

    // Update Google Sheets
    if (googleSheets1.auth) {
      await googleSheets1.approveAsset(assetCode);
    }

    // Post approval message with comments
    const approvalText = additionalComments 
      ? `✅ *APPROVED*\n\nAsset Code: ${assetCode}\nStatus: Finalized\n\n*Comments:* ${additionalComments}\n\nThis content has been approved and is ready for final use.`
      : `✅ *APPROVED*\n\nAsset Code: ${assetCode}\nStatus: Finalized\n\nThis content has been approved and is ready for final use.`;

    await client.chat.postMessage({
      channel: channelId,
      thread_ts: messageTs,
      text: approvalText
    });

  } catch (error) {
    console.error('Error handling approval submission:', error);
  }
});

// Need Changes modal submission
app.view('need_changes_modal', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const values = body.view.state.values;
    const feedbackComments = values.feedback_comments?.feedback_comments_input?.value || '';
    
    // Get data from private_metadata
    const data = JSON.parse(body.view.private_metadata);
    const { assetCode, channelId, messageTs, topic, assetName } = data;

    // Update Google Sheets
    if (googleSheets1.auth) {
      await googleSheets1.rejectAsset(assetCode);
    }

    // Post feedback message with comments
    const feedbackText = `🔄 *NEEDS CHANGES*\n\n*Asset Code:* ${assetCode}\n*Topic:* ${topic}\n*Asset Name:* ${assetName}\n*Status:* Draft\n\n*Feedback:* ${feedbackComments}\n\nPlease make the requested changes and submit for review again.`;

    await client.chat.postMessage({
      channel: channelId,
      thread_ts: messageTs,
      text: feedbackText,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: feedbackText
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Submit for Review',
                emoji: true
              },
              action_id: 'submit_for_review_btn',
              style: 'primary',
              value: assetCode
            }
          ]
        }
      ]
    });

  } catch (error) {
    console.error('Error handling need changes submission:', error);
  }
});

// Submit for Review button from feedback
app.action('submit_for_review_btn', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const assetCode = body.actions[0].value;
    const channelId = body.channel.id;

    // Open the submit for review modal
    const modalView = {
      type: 'modal',
      callback_id: 'submit_for_review_modal',
      private_metadata: JSON.stringify({ assetCode }),
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
            initial_value: assetCode,
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
              text: 'https://...',
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
          }
        }
      ]
    };

    await client.views.open({
      trigger_id: body.trigger_id,
      view: modalView
    });

  } catch (error) {
    console.error('Error opening submit for review modal:', error);
  }
});

// Upload Resource button handler
app.action('upload_resource_btn', async ({ ack, body, client }) => {
  console.log('🎯 Upload Resource button clicked');
  await ack();
  
  try {
    const data = JSON.parse(body.actions[0].value);
    const { assetCode, topic, assetName, resourceType } = data;
    
    // Get channel ID and message timestamp for thread reply
    const channelId = body.channel.id;
    const messageTs = body.message.ts;

    // Open upload modal
    const modalView = {
      type: 'modal',
      callback_id: 'upload_resource_modal',
      private_metadata: JSON.stringify({
        assetCode,
        topic,
        assetName,
        resourceType,
        channelId,
        messageTs
      }),
      title: {
        type: 'plain_text',
        text: 'Upload Resource',
        emoji: true
      },
      submit: {
        type: 'plain_text',
        text: 'Upload Files',
        emoji: true
      },
      close: {
        type: 'plain_text',
        text: 'Cancel',
        emoji: true
      },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Asset Code:* ${assetCode}\n*Topic:* ${topic}\n*Asset Name:* ${assetName}\n*Resource Type:* ${resourceType}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📁 *Upload Files to Google Drive*\n\n1️⃣ *Upload your files:*\n• Click this link: <https://drive.google.com/drive/folders/0AJSOdkOyQvNpUk9PVA|📁 Upload to Shared Resource Folder>\n• Navigate to the \`${resourceType}\` subfolder\n• Upload your files\n\n2️⃣ *Get the file link:*\n• Right-click on the uploaded file\n• Select "Get link" or "Share"\n• Copy the link\n\n3️⃣ *Paste the link below:*\n• Paste the Google Drive file link in the input field below`
          }
        },
        {
          type: 'input',
          block_id: 'file_link',
          label: {
            type: 'plain_text',
            text: 'Google Drive File Link',
            emoji: true
          },
          element: {
            type: 'plain_text_input',
            action_id: 'file_link_input',
            placeholder: {
              type: 'plain_text',
              text: 'https://drive.google.com/file/d/...',
              emoji: true
            }
          }
        }
      ]
    };

    await client.views.open({
      trigger_id: body.trigger_id,
      view: modalView
    });

  } catch (error) {
    console.error('Error opening upload modal:', error);
  }
});

// Upload Resource modal submission
app.view('upload_resource_modal', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const values = body.view.state.values;
    const fileLink = values.file_link?.file_link_input?.value || '';
    
    if (!fileLink.trim()) {
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: '❌ Please provide a Google Drive file link.'
      });
      return;
    }

    console.log('📁 Processing file link:', fileLink);

    // Get the original resource request data from the button that opened this modal
    const originalMessage = body.view.private_metadata;
    let assetData = {};
    
    try {
      assetData = JSON.parse(originalMessage);
    } catch (error) {
      console.error('Error parsing asset data from private_metadata:', error);
    }

    // Prepare file information
    const fileInfo = `*File Link:* <${fileLink}|📁 View File>\n`;

    // Post a reply in the original thread with asset details and file link
    const replyMessage = {
      channel: assetData.channelId || body.user.id,
      thread_ts: assetData.messageTs,
      text: `📁 *RESOURCE UPLOADED*\n\n*Asset Code:* ${assetData.assetCode || 'N/A'}\n*Topic:* ${assetData.topic || 'N/A'}\n*Asset Name:* ${assetData.assetName || 'N/A'}\n*Resource Type:* ${assetData.resourceType || 'N/A'}\n\n${fileInfo}\n📁 *Google Drive Location:*\n<https://drive.google.com/drive/folders/0AJSOdkOyQvNpUk9PVA|📁 Shared Resource Folder> → ${assetData.resourceType || 'Resource'} → ${assetData.assetCode || 'Asset'}\n\n✅ File has been uploaded to Google Drive.`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📁 RESOURCE UPLOADED',
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Asset Code:*\n${assetData.assetCode || 'N/A'}`
            },
            {
              type: 'mrkdwn',
              text: `*Resource Type:*\n${assetData.resourceType || 'N/A'}`
            }
          ]
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Topic:*\n${assetData.topic || 'N/A'}`
            },
            {
              type: 'mrkdwn',
              text: `*Asset Name:*\n${assetData.assetName || 'N/A'}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*File Link:* <${fileLink}|📁 View File>`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📁 *Google Drive Location:*\n<https://drive.google.com/drive/folders/0AJSOdkOyQvNpUk9PVA|📁 Shared Resource Folder> → ${assetData.resourceType || 'Resource'} → ${assetData.assetCode || 'Asset'}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ Files have been uploaded and organized in Google Drive.'
          }
        }
      ]
    };

    await client.chat.postMessage(replyMessage);

    // Send ephemeral message to user
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: `✅ File link added! A reply has been posted in the original thread with all details.`
    });

    // File link has been processed and thread reply posted
    console.log('✅ File link processed successfully');

  } catch (error) {
    console.error('Error handling file upload:', error);
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: '❌ Error processing uploaded files. Please try again.'
    });
  }
});

// Start the app
async function startApp() {
  try {
    // Validate environment
    validateEnvironment();

    // Initialize Google Sheets for both workflows
    await initializeGoogleSheets(googleSheets1, reviewConfig, 'Review Workflow');
    await initializeGoogleSheets(googleSheets2, resourceConfig, 'Resource Request');

    // Initialize Google Drive for resource requests
    await initializeGoogleDrive(resourceConfig, 'Resource Request');

    // Start Slack app
    await app.start();
    console.log('⚡️ Slack app is running with Socket Mode');

    // Start Express server for Heroku
    expressApp.listen(port, () => {
      console.log('🚀 Express server started on port', port);
      console.log('📋 Running both workflows in single Slack app');
      console.log(`📋 Review Workflow channel: ${reviewConfig.channelName || reviewConfig.channelId}`);
      console.log(`📋 Resource Request channel: ${resourceConfig.channelName || resourceConfig.channelId}`);
    });
  } catch (error) {
    console.error('Error starting app:', error);
    process.exit(1);
  }
}

startApp();

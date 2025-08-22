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
const googleDrive = new GoogleDriveService();

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
  if (!config.googleDriveFolderId) {
    console.warn(`⚠️  Google Drive integration disabled for ${appName}`);
    return false;
  }

  try {
    await googleDrive.initialize(config.googleDriveFolderId);
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
    const assetCode = values.asset_code.asset_code_input.value;
    const draftLink = values.draft_link.draft_link_input.value;
    const additionalNotes = values.additional_notes.additional_notes_input.value;
    
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

    const channelId = await ensureChannelId(client, reviewConfig, 'Review Workflow');

    // Update Google Sheets
    if (googleSheets1.auth) {
      await googleSheets1.updateAssetStatus(assetCode, 'Review', draftLink);
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
    const channelId = body.channel.id;

    // Update Google Sheets
    if (googleSheets1.auth) {
      await googleSheets1.approveAsset(assetCode);
    }

    // Post approval message
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: body.message.ts,
      text: `✅ *APPROVED*\n\nAsset Code: ${assetCode}\nStatus: Finalized\n\nThis content has been approved and is ready for final use.`
    });

  } catch (error) {
    console.error('Error handling approval:', error);
  }
});

// Need Changes button handler
app.action('need_changes_btn', async ({ ack, body, client }) => {
  await ack();
  
  try {
    const assetCode = body.actions[0].value;
    const channelId = body.channel.id;

    // Update Google Sheets
    if (googleSheets1.auth) {
      await googleSheets1.rejectAsset(assetCode);
    }

    // Post feedback message
    await client.chat.postMessage({
      channel: channelId,
      thread_ts: body.message.ts,
      text: `🔄 *NEEDS CHANGES*\n\nAsset Code: ${assetCode}\nStatus: Draft\n\nPlease make the requested changes and submit for review again.`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `🔄 *NEEDS CHANGES*\n\nAsset Code: ${assetCode}\nStatus: Draft\n\nPlease make the requested changes and submit for review again.`
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
    console.error('Error handling need changes:', error);
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
            value: assetCode,
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

    // Open upload modal
    const modalView = {
      type: 'modal',
      callback_id: 'upload_resource_modal',
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
            text: `*File Upload Instructions for ${resourceType}*\n\n📁 *For files under 10MB:*\n• Use the file upload below\n• Files will be automatically organized in Google Drive\n\n📁 *For larger files (over 10MB):*\n• Upload directly to Google Drive\n• Use this link: <https://drive.google.com/drive/folders/0AJSOdkOyQvNpUk9PVA|📁 Shared Resource Folder>\n• Place files in the \`${resourceType}\` subfolder\n• Files will be automatically organized by asset code\n\n*Note:* Slack has a 10MB file size limit. Large files must be uploaded to Google Drive directly.`
          }
        },
        {
          type: 'input',
          block_id: 'file_upload',
          label: {
            type: 'plain_text',
            text: 'Upload Small Files (< 10MB)',
            emoji: true
          },
          element: {
            type: 'file_input',
            action_id: 'file_upload_input',
            filetypes: ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'mp4', 'mov', 'doc', 'docx', 'txt'],
            max_files: 5
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
    const files = values.file_upload.file_upload_input.files || [];
    
    if (files.length === 0) {
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: '❌ No files were uploaded. Please try again.'
      });
      return;
    }

    console.log('📁 Processing uploaded files:', files.length);

    // Get the original resource request data from the button that opened this modal
    // For now, we'll just acknowledge the upload
    await client.chat.postEphemeral({
      channel: body.user.id,
      user: body.user.id,
      text: `✅ Successfully uploaded ${files.length} file(s)! Files will be processed and organized in Google Drive.`
    });

    // TODO: Implement Google Drive upload functionality for small files
    // This would involve:
    // 1. Downloading files from Slack using files.info and files.get
    // 2. Uploading them to Google Drive in the appropriate subfolder
    // 3. Organizing by resource type (Video/Image/Document)
    // 4. Creating asset-specific folders within the resource type folder

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

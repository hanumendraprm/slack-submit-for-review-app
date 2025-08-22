require('dotenv').config();
const { App } = require('@slack/bolt');
const express = require('express');
const GoogleSheetsService = require('./googleSheets');

// Create Express app for Heroku health checks
const expressApp = express();
const port = process.env.PORT || 3000;

// Health check endpoint for Heroku
expressApp.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    apps: ['app1', 'app2'] // List your active apps
  });
});

// App 1 Configuration (Your current app)
const app1 = new App({
  token: process.env.SLACK_BOT_TOKEN_APP1 || process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET_APP1 || process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN_APP1 || process.env.SLACK_APP_TOKEN
});

// App 2 Configuration (New app)
const app2 = new App({
  token: process.env.SLACK_BOT_TOKEN_APP2,
  signingSecret: process.env.SLACK_SIGNING_SECRET_APP2,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN_APP2
});

// App-specific configurations
const app1Config = {
  channelId: process.env.CHANNEL_ID_APP1 || process.env.CHANNEL_ID || null,
  channelName: process.env.CHANNEL_NAME_APP1 || process.env.CHANNEL_NAME,
  googleSheetId: process.env.GOOGLE_SHEET_ID_APP1 || process.env.GOOGLE_SHEET_ID,
  googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_APP1 || process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
  appName: 'App1'
};

const app2Config = {
  channelId: process.env.CHANNEL_ID_APP2 || null,
  channelName: process.env.CHANNEL_NAME_APP2,
  googleSheetId: process.env.GOOGLE_SHEET_ID_APP2,
  googleServiceAccountKey: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_APP2,
  appName: 'App2'
};

// Initialize Google Sheets services
const googleSheets1 = new GoogleSheetsService();
const googleSheets2 = new GoogleSheetsService();

/**
 * Validate required environment variables for an app
 */
function validateAppEnvironment(appConfig, appName) {
  const required = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_APP_TOKEN'];
  const missing = required.filter(key => !process.env[`${key}_${appName.toUpperCase()}`] && !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables for ${appName}: ${missing.join(', ')}`);
  }
  
  if (!appConfig.channelId && !appConfig.channelName) {
    throw new Error(`Either CHANNEL_ID_${appName.toUpperCase()} or CHANNEL_NAME_${appName.toUpperCase()} must be set for ${appName}`);
  }

  // Check Google Sheets configuration
  if (!appConfig.googleSheetId) {
    console.warn(`⚠️  GOOGLE_SHEET_ID_${appName.toUpperCase()} not set - Google Sheets integration will be disabled for ${appName}`);
  }
  if (!appConfig.googleServiceAccountKey) {
    console.warn(`⚠️  GOOGLE_SERVICE_ACCOUNT_KEY_${appName.toUpperCase()} not set - Google Sheets integration will be disabled for ${appName}`);
  }
}

/**
 * Resolve private channel ID by name for a specific app
 */
async function ensureChannelId(client, appConfig, appName) {
  if (appConfig.channelId) return appConfig.channelId;
  if (!appConfig.channelName) {
    throw new Error(`Set CHANNEL_NAME_${appName.toUpperCase()} or CHANNEL_ID_${appName.toUpperCase()} in .env`);
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
 * Validate form inputs for a specific app
 */
function validateFormInputs(view, appName) {
  const errors = {};
  const values = view.state.values;

  // Asset Code validation
  const assetCode = values.asset_code?.asset_code_input?.value;
  if (!assetCode || assetCode.trim() === '') {
    errors.asset_code = 'Asset Code is required';
  } else if (!/^[A-Z0-9-]+$/.test(assetCode.trim())) {
    errors.asset_code = 'Asset Code must contain only uppercase letters, numbers, and hyphens';
  }

  // Draft Link validation
  const draftLink = values.draft_link?.draft_link_input?.value;
  if (!draftLink || draftLink.trim() === '') {
    errors.draft_link = 'Draft Link is required';
  } else if (!draftLink.startsWith('http://') && !draftLink.startsWith('https://')) {
    errors.draft_link = 'Draft Link must be a valid URL starting with http:// or https://';
  }

  // Additional Notes validation (optional)
  const additionalNotes = values.additional_notes?.additional_notes_input?.value;
  if (additionalNotes && additionalNotes.length > 1000) {
    errors.additional_notes = 'Additional Notes must be 1000 characters or less';
  }

  return errors;
}

/**
 * Initialize Google Sheets for a specific app
 */
async function initializeGoogleSheets(googleSheets, appConfig, appName) {
  if (!appConfig.googleSheetId || !appConfig.googleServiceAccountKey) {
    console.warn(`⚠️ Google Sheets integration disabled for ${appName} - set GOOGLE_SHEET_ID_${appName.toUpperCase()} and GOOGLE_SERVICE_ACCOUNT_KEY_${appName.toUpperCase()} to enable`);
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

// App 1 Event Handlers
app1.shortcut('submit_for_review', async ({ shortcut, ack, client }) => {
  await ack();
  
  try {
    const channelId = await ensureChannelId(client, app1Config, 'App1');
    
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
    console.error('Error opening modal for App1:', error);
  }
});

// App 2 Event Handlers (similar structure but with different callback IDs)
app2.shortcut('submit_for_review', async ({ shortcut, ack, client }) => {
  await ack();
  
  try {
    const channelId = await ensureChannelId(client, app2Config, 'App2');
    
    const modalView = {
      type: 'modal',
      callback_id: 'submit_for_review_modal_app2',
      title: {
        type: 'plain_text',
        text: 'Submit for Review (App2)',
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
              action_id: 'fetch_details_btn_app2',
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
    console.error('Error opening modal for App2:', error);
  }
});

// Add more event handlers for both apps...
// (You can copy the existing handlers from app.js and modify them for each app)

// Start both apps
async function startApps() {
  try {
    // Validate environment for both apps
    validateAppEnvironment(app1Config, 'App1');
    validateAppEnvironment(app2Config, 'App2');

    // Initialize Google Sheets for both apps
    await initializeGoogleSheets(googleSheets1, app1Config, 'App1');
    await initializeGoogleSheets(googleSheets2, app2Config, 'App2');

    // Start App 1
    await app1.start();
    console.log('⚡️ App1 is running with Socket Mode');

    // Start App 2
    await app2.start();
    console.log('⚡️ App2 is running with Socket Mode');

    // Start Express server for Heroku
    expressApp.listen(port, () => {
      console.log('🚀 Express server started on port', port);
      console.log('📋 Running 2 Slack apps on single dyno');
      console.log(`📋 App1 channel: ${app1Config.channelName || app1Config.channelId}`);
      console.log(`📋 App2 channel: ${app2Config.channelName || app2Config.channelId}`);
    });
  } catch (error) {
    console.error('Error starting apps:', error);
    process.exit(1);
  }
}

startApps();

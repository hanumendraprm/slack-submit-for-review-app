require('dotenv').config();
const { App } = require('@slack/bolt');
const GoogleSheetsService = require('./googleSheets');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

let TARGET_CHANNEL_ID = process.env.CHANNEL_ID || null;
const TARGET_CHANNEL_NAME = process.env.CHANNEL_NAME;

// Initialize Google Sheets service
const googleSheets = new GoogleSheetsService();

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const required = ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'SLACK_APP_TOKEN'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  if (!TARGET_CHANNEL_ID && !TARGET_CHANNEL_NAME) {
    throw new Error('Either CHANNEL_ID or CHANNEL_NAME must be set in environment variables');
  }

  // Check Google Sheets configuration
  if (!process.env.GOOGLE_SHEET_ID) {
    console.warn('⚠️  GOOGLE_SHEET_ID not set - Google Sheets integration will be disabled');
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.warn('⚠️  GOOGLE_SERVICE_ACCOUNT_KEY not set - Google Sheets integration will be disabled');
  }
}

/**
 * Resolve private channel ID by name (once on startup if needed).
 */
async function ensureChannelId(client) {
  if (TARGET_CHANNEL_ID) return TARGET_CHANNEL_ID;
  if (!TARGET_CHANNEL_NAME) {
    throw new Error('Set CHANNEL_NAME or CHANNEL_ID in .env');
  }

  try {
    // First try to get the channel directly by name
    try {
      const res = await client.conversations.list({
        types: 'private_channel',
        limit: 1000
      });
      
      const match = (res.channels || []).find(
        ch => ch.name === TARGET_CHANNEL_NAME
      );
      
      if (match) {
        TARGET_CHANNEL_ID = match.id;
        return TARGET_CHANNEL_ID;
      }
    } catch (listError) {
      console.error('Error listing conversations:', listError);
    }

    // If not found, try to join the channel by name
    try {
      const joinRes = await client.conversations.join({
        channel: TARGET_CHANNEL_NAME
      });
      
      if (joinRes.ok && joinRes.channel) {
        TARGET_CHANNEL_ID = joinRes.channel.id;
        return TARGET_CHANNEL_ID;
      }
    } catch (joinError) {
      console.error('Error joining channel:', joinError);
    }

    // If all else fails, throw error
    throw new Error(
      `Could not find or join private channel named #${TARGET_CHANNEL_NAME}. ` +
      `Ensure the app is installed and invited to the channel.`
    );
  } catch (error) {
    console.error('Error resolving channel ID:', error);
    throw error;
  }
}

/**
 * Validate form inputs
 */
function validateFormInputs(values) {
  const errors = {};
  
  const assetCode = values.asset_code_block?.asset_code_input?.value?.trim();
  const topic = values.topic_block?.topic_input?.value?.trim();
  const assetName = values.asset_name_block?.asset_name_input?.value?.trim();
  const draftLink = values.draft_link_block?.draft_link_input?.value?.trim();
  
  if (!assetCode) errors.asset_code = 'Asset Code is required';
  if (!draftLink) errors.draft_link = 'Draft Link is required';
  
  // Basic URL validation
  if (draftLink && !draftLink.match(/^https?:\/\/.+/)) {
    errors.draft_link = 'Draft Link must be a valid URL starting with http:// or https://';
  }
  
  // For Topic and Asset Name, we'll handle missing values in the submission handler
  // by fetching them from Google Sheets if they're missing
  
  return { errors, values: { assetCode, topic, assetName, draftLink } };
}

/**
 * GLOBAL SHORTCUT: "Submit for Review"
 * Opens the modal with 5 fields.
 */
app.shortcut('submit_for_review_shortcut', async ({ ack, body, client, logger }) => {
  await ack();

  try {
    // Open modal
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'submit_for_review_modal',
        title: { type: 'plain_text', text: 'Submit for Review' },
        submit: { type: 'plain_text', text: 'Submit' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'input',
            block_id: 'asset_code_block',
            label: { type: 'plain_text', text: 'Asset Code' },
            element: {
              type: 'plain_text_input',
              action_id: 'asset_code_input',
              placeholder: { type: 'plain_text', text: 'e.g., GW1' }
            }
          },
          {
            type: 'actions',
            block_id: 'fetch_details_block',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Fetch Details' },
                action_id: 'fetch_details_btn',
                style: 'primary'
              }
            ]
          },
          {
            type: 'input',
            block_id: 'topic_block',
            label: { type: 'plain_text', text: 'Topic' },
            element: {
              type: 'plain_text_input',
              action_id: 'topic_input',
              placeholder: { type: 'plain_text', text: 'Automatically Fetched: Topic of the Asset' }
            }
          },
          {
            type: 'input',
            block_id: 'asset_name_block',
            label: { type: 'plain_text', text: 'Asset Name' },
            element: {
              type: 'plain_text_input',
              action_id: 'asset_name_input',
              placeholder: { type: 'plain_text', text: 'Automatically Fetched: LinkedIn Post etc.' }
            }
          },
          {
            type: 'input',
            block_id: 'draft_link_block',
            label: { type: 'plain_text', text: 'Draft Link' },
            element: {
              type: 'plain_text_input',
              action_id: 'draft_link_input',
              placeholder: { type: 'plain_text', text: 'https://docs.google.com/...' }
            }
          },
          {
            type: 'input',
            block_id: 'notes_block',
            optional: true,
            label: { type: 'plain_text', text: 'Additional Notes' },
            element: {
              type: 'plain_text_input',
              action_id: 'notes_input',
              multiline: true,
              placeholder: { type: 'plain_text', text: 'Any additional context or notes...' }
            }
          }
        ]
      }
    });
  } catch (error) {
    logger.error('Error opening modal:', error);
    // Try to send an ephemeral message to the user
    try {
      await client.chat.postEphemeral({
        user: body.user.id,
        channel: body.channel?.id || body.user.id,
        text: '❌ Sorry, there was an error opening the form. Please try again.'
      });
    } catch (ephemeralError) {
      logger.error('Error sending ephemeral message:', ephemeralError);
    }
  }
});

/**
 * Handle "Fetch Details" button click - fetch data directly
 */
app.action('fetch_details_btn', async ({ ack, body, client, logger }) => {
  await ack();

  try {
    // Get the current asset code from the modal state
    const assetCode = body.view?.state?.values?.asset_code_block?.asset_code_input?.value?.trim();
    
    if (!assetCode) {
      await client.chat.postEphemeral({
        user: body.user.id,
        channel: body.channel?.id || body.user.id,
        text: '⚠️ Please enter an Asset Code first, then click "Fetch Details".\n\n💡 Try entering "GW2" or "GW3" in the Asset Code field above.'
      });
      return;
    }

    if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      await client.chat.postEphemeral({
        user: body.user.id,
        channel: body.channel?.id || body.user.id,
        text: '⚠️ Google Sheets integration is not configured. Please contact your administrator.'
      });
      return;
    }

    // Validate asset code and get details
    const validation = await googleSheets.validateAssetCode(assetCode);
    
    if (validation.valid && validation.asset) {
      const asset = validation.asset;
      
      // Update the current modal with fetched data
      await client.views.update({
        view_id: body.view.id,
        view: {
          type: 'modal',
          callback_id: 'submit_for_review_modal',
          title: { type: 'plain_text', text: 'Submit for Review' },
          submit: { type: 'plain_text', text: 'Submit' },
          close: { type: 'plain_text', text: 'Cancel' },
          blocks: [
            {
              type: 'input',
              block_id: 'asset_code_block',
              label: { type: 'plain_text', text: 'Asset Code' },
              element: {
                type: 'plain_text_input',
                action_id: 'asset_code_input',
                initial_value: assetCode,
                placeholder: { type: 'plain_text', text: 'e.g., ASSET-001' }
              }
            },
            {
              type: 'actions',
              block_id: 'fetch_details_block',
              elements: [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: '✅ Details Fetched' },
                  action_id: 'fetch_details_btn',
                  style: 'primary'
                }
              ]
            },
            {
              type: 'input',
              block_id: 'topic_block',
              label: { type: 'plain_text', text: 'Topic' },
              element: {
                type: 'plain_text_input',
                action_id: 'topic_input',
                initial_value: asset['Topic'] || '',
                placeholder: { type: 'plain_text', text: 'e.g., Product Launch' }
              }
            },
            {
              type: 'input',
              block_id: 'asset_name_block',
              label: { type: 'plain_text', text: 'Asset Name' },
              element: {
                type: 'plain_text_input',
                action_id: 'asset_name_input',
                initial_value: asset['Asset Name'] || '',
                placeholder: { type: 'plain_text', text: 'e.g., Q1 Product Launch Video' }
              }
            },
            {
              type: 'input',
              block_id: 'draft_link_block',
              label: { type: 'plain_text', text: 'Draft Link' },
              element: {
                type: 'plain_text_input',
                action_id: 'draft_link_input',
                placeholder: { type: 'plain_text', text: 'https://docs.google.com/...' }
              }
            },
            {
              type: 'input',
              block_id: 'notes_block',
              optional: true,
              label: { type: 'plain_text', text: 'Additional Notes' },
              element: {
                type: 'plain_text_input',
                action_id: 'notes_input',
                multiline: true,
                placeholder: { type: 'plain_text', text: 'Any additional context or notes...' }
              }
            }
          ]
        }
      });

      // Send confirmation message
      await client.chat.postEphemeral({
        user: body.user.id,
        channel: body.channel?.id || body.user.id,
        text: `✅ Successfully fetched details for Asset Code: *${assetCode}*\n*Topic:* ${asset['Topic'] || 'N/A'}\n*Asset Name:* ${asset['Asset Name'] || 'N/A'}\n\n💡 **Important**: Please click inside the Topic and Asset Name fields to ensure they are properly filled, then click Submit.`
      });

    } else if (!validation.valid) {
      // Show error message
      await client.chat.postEphemeral({
        user: body.user.id,
        channel: body.channel?.id || body.user.id,
        text: `⚠️ ${validation.error}\n\n💡 Try using "GW2" or "GW3" which have "Draft" status.`
      });
    }
  } catch (error) {
    logger.error('Error fetching asset details:', error);
    await client.chat.postEphemeral({
      user: body.user.id,
      channel: body.channel?.id || body.user.id,
      text: '❌ Error fetching asset details. Please try again or contact support.'
    });
  }
});



/**
 * Handle modal submission:
 * Post formatted message to the private channel + Approve/Need Changes buttons.
 */
app.view('submit_for_review_modal', async ({ ack, body, view, client, logger }) => {
  try {
    // Validate inputs first
    const { errors, values } = validateFormInputs(view.state.values);
    
    if (Object.keys(errors).length > 0) {
      await ack({
        response_action: 'errors',
        errors: errors
      });
      return;
    }

    // Acknowledge the submission immediately
    await ack();

    // Get additional data
    const notes = view.state.values.notes_block?.notes_input?.value?.trim() || '';
    
    // If Topic or Asset Name are missing, try to fetch them from Google Sheets
    let finalTopic = values.topic;
    let finalAssetName = values.assetName;
    
    if ((!finalTopic || !finalAssetName) && process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        const validation = await googleSheets.validateAssetCode(values.assetCode);
        
        if (validation.valid && validation.asset) {
          if (!finalTopic) {
            finalTopic = validation.asset['Topic'] || 'N/A';
          }
          if (!finalAssetName) {
            finalAssetName = validation.asset['Asset Name'] || 'N/A';
          }
        }
      } catch (sheetError) {
        logger.error('Error fetching missing data from Google Sheets:', sheetError);
        // Use fallback values
        if (!finalTopic) finalTopic = 'N/A';
        if (!finalAssetName) finalAssetName = 'N/A';
      }
    } else {
      // Use fallback values if Google Sheets not configured
      if (!finalTopic) finalTopic = 'N/A';
      if (!finalAssetName) finalAssetName = 'N/A';
    }
    
    // Get channel ID
    let channel;
    try {
      channel = await ensureChannelId(client);
    } catch (channelError) {
      logger.error('Error getting channel ID:', channelError);
      // Send error message to user
      await client.chat.postEphemeral({
        user: body.user.id,
        channel: body.channel?.id || body.user.id,
        text: '❌ Error: Could not find the target channel. Please contact your administrator.'
      });
      return;
    }

    // Update Google Sheet if configured
    let sheetUpdated = false;
    if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        await googleSheets.updateAssetStatus(values.assetCode, values.draftLink);
        logger.info(`Updated Google Sheet for asset: ${values.assetCode}`);
        sheetUpdated = true;
      } catch (sheetError) {
        logger.error('Error updating Google Sheet:', sheetError);
        // Continue with Slack message even if sheet update fails
      }
    }

    // Compose the text block exactly as requested
    const textLines = [
      '*DRAFT COMPLETED | READY FOR REVIEW*',
      `*Code:* ${values.assetCode}`,
      `*Topic:* ${finalTopic}`,
      `*Asset Name:* ${finalAssetName}`,
      `*Status:* Draft → Ready for Review`,
      `*Draft Link:* ${values.draftLink}`,
      '',
      `*Notes:* ${notes || '_No additional notes_'}`,
      '',
      '<@garry.woodford> - Please review this asset!',
      'Next Action: Garry to review and approve/request changes',
      '',
      '*Click below to start review:*'
    ].join('\n');

    // Post message to channel
    try {
      await client.chat.postMessage({
        channel,
        text: 'Draft completed and ready for review',
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: textLines }
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Approve' },
                style: 'primary',
                action_id: 'approve_btn'
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Need Changes' },
                style: 'danger',
                action_id: 'need_changes_btn'
              }
            ]
          }
        ]
      });

      // Send ephemeral confirmation message to user only
      await client.chat.postEphemeral({
        user: body.user.id,
        channel,
        text: `✅ Successfully submitted for review! Your submission has been posted to <#${channel}>.`
      });

    } catch (messageError) {
      logger.error('Error posting message to channel:', messageError);
      await client.chat.postEphemeral({
        user: body.user.id,
        channel: body.channel?.id || body.user.id,
        text: '❌ Error posting message to channel. Please try again or contact support.'
      });
    }

  } catch (error) {
    logger.error('Error handling modal submission:', error);
    // Try to send error message to user
    try {
      await client.chat.postEphemeral({
        user: body.user.id,
        channel: body.channel?.id || body.user.id,
        text: '❌ An unexpected error occurred. Please try again or contact support.'
      });
    } catch (ephemeralError) {
      logger.error('Error sending error message:', ephemeralError);
    }
  }
});

/**
 * APPROVE button → open comments modal, then reply in thread "Approved".
 */
app.action('approve_btn', async ({ ack, body, client, logger }) => {
  await ack();

  try {
    // Extract asset code from the message text
    const messageText = body.message.blocks[0].text.text;
    const assetCodeMatch = messageText.match(/\*Code:\*\s*([^\n]+)/);
    const assetCode = assetCodeMatch ? assetCodeMatch[1].trim() : null;

    if (!assetCode) {
      await client.chat.postEphemeral({
        user: body.user.id,
        channel: body.channel.id,
        text: '❌ Could not find asset code in the message. Please contact support.'
      });
      return;
    }

    // Store metadata for the modal submission
    const metadata = JSON.stringify({
      channel: body.channel.id,
      thread_ts: body.message.ts,
      assetCode: assetCode,
      approver: body.user.id
    });

    // Open approval comments modal
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'approve_comments_modal',
        title: { type: 'plain_text', text: 'Approve Asset' },
        submit: { type: 'plain_text', text: 'Approve' },
        close: { type: 'plain_text', text: 'Cancel' },
        private_metadata: metadata,
        blocks: [
          {
            type: 'section',
            text: { 
              type: 'mrkdwn', 
              text: `*Asset Code:* ${assetCode}\n\nPlease add any comments for this approval (optional):` 
            }
          },
          {
            type: 'input',
            block_id: 'approval_comments_block',
            optional: true,
            label: { type: 'plain_text', text: 'Approval Comments' },
            element: {
              type: 'plain_text_input',
              action_id: 'approval_comments_input',
              multiline: true,
              placeholder: { type: 'plain_text', text: 'Any comments or feedback...' }
            }
          }
        ]
      }
    });
  } catch (error) {
    logger.error('Error opening approval modal:', error);
    await client.chat.postEphemeral({
      user: body.user.id,
      channel: body.channel.id,
      text: '❌ Error opening approval form. Please try again.'
    });
  }
});

/**
 * Handle approval comments modal submission
 */
app.view('approve_comments_modal', async ({ ack, body, view, client, logger }) => {
  try {
    await ack();

    const metadata = JSON.parse(view.private_metadata);
    const comments = view.state.values.approval_comments_block?.approval_comments_input?.value?.trim() || '';
    
    // Update Google Sheet status to Finalized
    if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        await googleSheets.approveAsset(metadata.assetCode);
        logger.info(`Approved asset: ${metadata.assetCode}`);
      } catch (sheetError) {
        logger.error('Error updating Google Sheet for approval:', sheetError);
        // Continue with Slack message even if sheet update fails
      }
    }

    // Post approval message in thread
    const approvalText = comments 
      ? `✅ *Approved by* <@${metadata.approver}>\n\n*Comments:* ${comments}`
      : `✅ *Approved by* <@${metadata.approver}>`;

    await client.chat.postMessage({
      channel: metadata.channel,
      thread_ts: metadata.thread_ts,
      text: approvalText
    });

  } catch (error) {
    logger.error('Error handling approval submission:', error);
    try {
      await client.chat.postEphemeral({
        user: body.user.id,
        channel: body.channel?.id || body.user.id,
        text: '❌ Error processing approval. Please try again or contact support.'
      });
    } catch (ephemeralError) {
      logger.error('Error sending error message:', ephemeralError);
    }
  }
});

/**
 * NEED CHANGES button → open a modal to collect feedback.
 */
app.action('need_changes_btn', async ({ ack, body, client, logger }) => {
  await ack();

  try {
    // Extract asset code from the message text
    const messageText = body.message.blocks[0].text.text;
    const assetCodeMatch = messageText.match(/\*Code:\*\s*([^\n]+)/);
    const assetCode = assetCodeMatch ? assetCodeMatch[1].trim() : null;

    if (!assetCode) {
      await client.chat.postEphemeral({
        user: body.user.id,
        channel: body.channel.id,
        text: '❌ Could not find asset code in the message. Please contact support.'
      });
      return;
    }

    // Store channel/thread_ts and asset code for the follow-up reply
    const metadata = JSON.stringify({
      channel: body.channel.id,
      thread_ts: body.message.ts,
      assetCode: assetCode
    });

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'need_changes_modal',
        title: { type: 'plain_text', text: 'Need Changes' },
        submit: { type: 'plain_text', text: 'Submit Feedback' },
        close: { type: 'plain_text', text: 'Cancel' },
        private_metadata: metadata,
        blocks: [
          {
            type: 'input',
            block_id: 'feedback_block',
            label: { type: 'plain_text', text: 'Feedback to the author' },
            element: {
              type: 'plain_text_input',
              action_id: 'feedback_input',
              multiline: true,
              placeholder: { type: 'plain_text', text: 'Be specific and actionable with your feedback...' }
            }
          }
        ]
      }
    });
  } catch (error) {
    logger.error('Error opening feedback modal:', error);
  }
});

/**
 * Handle Need Changes modal submission → reply with the feedback in the same thread.
 */
app.view('need_changes_modal', async ({ ack, body, view, client, logger }) => {
  try {
    const feedback = view.state.values.feedback_block?.feedback_input?.value?.trim();
    
    if (!feedback) {
      await ack({
        response_action: 'errors',
        errors: {
          feedback_block: 'Feedback is required'
        }
      });
      return;
    }

    await ack();
    
    const meta = JSON.parse(view.private_metadata);

    // Update Google Sheet status back to Draft
    if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        await googleSheets.rejectAsset(meta.assetCode);
        logger.info(`Rejected asset: ${meta.assetCode}`);
      } catch (sheetError) {
        logger.error('Error updating Google Sheet for rejection:', sheetError);
        // Continue with Slack message even if sheet update fails
      }
    }

    // Post feedback message with Submit for Review button
    await client.chat.postMessage({
      channel: meta.channel,
      thread_ts: meta.thread_ts,
      text: `📝 *Changes requested by* <@${body.user.id}>:\n\n>${feedback}`,
      blocks: [
        {
          type: 'section',
          text: { 
            type: 'mrkdwn', 
            text: `📝 *Changes requested by* <@${body.user.id}>:\n\n>${feedback}` 
          }
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Submit for Review' },
              style: 'primary',
              action_id: 'submit_for_review_from_feedback',
              value: meta.assetCode // Store asset code in button value
            }
          ]
        }
      ]
    });
  } catch (error) {
    logger.error('Error handling feedback submission:', error);
    await ack({
      response_action: 'errors',
      errors: {
        feedback_block: 'An unexpected error occurred. Please try again.'
      }
    });
  }
});



/**
 * Submit for Review button from feedback message → open modal for the specific asset
 */
app.action('submit_for_review_from_feedback', async ({ ack, body, client, logger }) => {
  await ack();

  try {
    // Get asset code from the button value
    const assetCode = body.actions[0].value;

    if (!assetCode) {
      await client.chat.postEphemeral({
        user: body.user.id,
        channel: body.channel.id,
        text: '❌ Could not find asset code. Please use the global shortcut instead.'
      });
      return;
    }

    // Pre-fill the modal with the asset code
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'submit_for_review_modal',
        title: { type: 'plain_text', text: 'Submit for Review' },
        submit: { type: 'plain_text', text: 'Submit' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'input',
            block_id: 'asset_code_block',
            label: { type: 'plain_text', text: 'Asset Code' },
            element: {
              type: 'plain_text_input',
              action_id: 'asset_code_input',
              initial_value: assetCode,
              placeholder: { type: 'plain_text', text: 'e.g., ASSET-001' }
            }
          },
          {
            type: 'actions',
            block_id: 'fetch_details_block',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: 'Fetch Details' },
                action_id: 'fetch_details_btn',
                style: 'primary'
              }
            ]
          },
          {
            type: 'input',
            block_id: 'topic_block',
            label: { type: 'plain_text', text: 'Topic' },
            element: {
              type: 'plain_text_input',
              action_id: 'topic_input',
              placeholder: { type: 'plain_text', text: 'Automatically Fetched: Topic of the Asset' }
            }
          },
          {
            type: 'input',
            block_id: 'asset_name_block',
            label: { type: 'plain_text', text: 'Asset Name' },
            element: {
              type: 'plain_text_input',
              action_id: 'asset_name_input',
              placeholder: { type: 'plain_text', text: 'Automatically Fetched: LinkedIn Post etc.' }
            }
          },
          {
            type: 'input',
            block_id: 'draft_link_block',
            label: { type: 'plain_text', text: 'Draft Link' },
            element: {
              type: 'plain_text_input',
              action_id: 'draft_link_input',
              placeholder: { type: 'plain_text', text: 'https://docs.google.com/...' }
            }
          },
          {
            type: 'input',
            block_id: 'notes_block',
            optional: true,
            label: { type: 'plain_text', text: 'Additional Notes' },
            element: {
              type: 'plain_text_input',
              action_id: 'notes_input',
              multiline: true,
              placeholder: { type: 'plain_text', text: 'Any additional context or notes...' }
            }
          }
        ]
      }
    });

  } catch (error) {
    logger.error('Error opening submit for review modal from feedback:', error);
    await client.chat.postEphemeral({
      user: body.user.id,
      channel: body.channel.id,
      text: '❌ Error opening the form. Please use the global shortcut instead.'
    });
  }
});

/**
 * Error handler for unhandled errors
 */
app.error(async (error) => {
  console.error('Unhandled error:', error);
});

/**
 * Health check endpoint for Heroku
 */
app.receiver.app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Start the app
 */
(async () => {
  try {
    validateEnvironment();
    
    // Initialize Google Sheets if configured
    if (process.env.GOOGLE_SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      await googleSheets.initialize();
      console.log('📊 Google Sheets integration enabled');
    } else {
      console.log('⚠️  Google Sheets integration disabled - set GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY to enable');
    }
    
    await app.start(process.env.PORT || 3000);
    console.log('⚡️ Bolt app is running on port', process.env.PORT || 3000);
    console.log('📋 Target channel:', TARGET_CHANNEL_NAME || TARGET_CHANNEL_ID);
  } catch (error) {
    console.error('Failed to start app:', error);
    process.exit(1);
  }
})();

// netlify/functions/webhook.js
// DEPRECATION STUB — original Netlify webhook removed and replaced with this stub.
// This file intentionally returns 410 Gone so incoming requests won't run the old logic
// that required @supabase/supabase-js. If you want a full deletion from the repo, remove
// this file via the GitHub web UI or the git CLI.

exports.handler = async function(event, context) {
  console.warn('Deprecated webhook function called — this endpoint has been removed.');
  return {
    statusCode: 410,
    body: JSON.stringify({
      success: false,
      message: 'This webhook function has been removed. Use the new implementation.'
    })
  };
};

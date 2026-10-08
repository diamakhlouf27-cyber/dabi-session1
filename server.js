const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load configuration from environment variables (Never hardcode secrets!)
const BASE_URL = process.env.BASE_URL || 'https://api.yapily.com';
const APPLICATION_ID = process.env.APPLICATION_ID;
const APPLICATION_SECRET = process.env.APPLICATION_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL || 'https://dabi-session1-cosv.onrender.com/callback/consent';
const APPLICATION_USER_ID = process.env.APPLICATION_USER_ID || 'dabi-lab3';
const INSTITUTION_ID = 'modelo-sandbox';

// Helper for HTTP Basic Auth
const getAuthHeader = () => {
  const credentials = Buffer.from(`${APPLICATION_ID}:${APPLICATION_SECRET}`).toString('base64');
  return `Basic ${credentials}`;
};

// --- FRONTEND ROUTE ---
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head><title>DABI Lab - Yapily</title></head>
      <body style="font-family: Arial; text-align: center; margin-top: 50px;">
        <h1>Yapily Open Banking Integration</h1>
        <button id="auth-btn" style="padding: 10px 20px; font-size: 16px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">
          Authorize Bank Access
        </button>
        <script>
          document.getElementById('auth-btn').addEventListener('click', async () => {
            try {
              const response = await fetch('/api/auth-request', { method: 'POST' });
              const data = await response.json();
              const authUrl = data.data?.url || data.url;
              if (authUrl) {
                window.location.href = authUrl;
              } else {
                alert("Could not get authorization URL. Check console.");
                console.log(data);
              }
            } catch (err) {
              console.error("Error:", err);
            }
          });
        </script>
      </body>
    </html>
  `);
});
app.post('/api/auth-request', async (req, res) => {
  try {
    const response = await fetch(`${BASE_URL}/account-auth-requests`, {
      method: 'POST',
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        applicationUserId: APPLICATION_USER_ID,
        institutionId: INSTITUTION_ID,
        callback: CALLBACK_URL,
        type: "ACCOUNT_AUTHORISATION"
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
   

// --- CALLBACK ROUTE (Handles return from bank) ---
app.get('/callback/consent', async (req, res) => {
  const consentToken = req.query.consentToken || req.query.consent;
  
  if (!consentToken) {
    return res.status(400).send("Error: No consent token found in redirect query string.");
  }

  try {
    // Fetch Accounts using the consent token header
    const accountsRes = await fetch(`${BASE_URL}/accounts`, {
      headers: {
        'Authorization': getAuthHeader(),
        'consent': consentToken
      }
    });
    const accountsData = await accountsRes.json();

    // Render success view back to the user
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Consent Success</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f4f4f9; color: #333; }
          .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          pre { background: #eee; padding: 15px; border-radius: 4px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>✅ Bank Authorization Successful!</h2>
          <p><strong>Consent Token Captured:</strong> ${consentToken}</p>
          <h3>Fetched Accounts (GET /accounts):</h3>
          <pre>${JSON.stringify(accountsData, null, 2)}</pre>
          <a href="/">Back to Home</a>
        </div>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send(`Error fetching accounts: ${err.message}`);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

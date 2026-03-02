const axios = require('axios');
const credentials = Buffer.from('ColeDiGr-Goo-SBX-f4eb38236-93def868:SBX-4eb382362a0b-4dd7-4518-a1a9-323c').toString('base64');
axios.post('https://api.sandbox.ebay.com/identity/v1/oauth2/token', 
  'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope', 
  { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${credentials}` } }
).then(res => console.log(res.data)).catch(err => console.error(err.response?.data || err.message));

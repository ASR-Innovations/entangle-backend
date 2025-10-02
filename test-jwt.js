const jwt = require('jsonwebtoken');

const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInBhcmFVc2VySWQiOiJlbWFpbF9jbTlvYVhRdWNtRnFjM1Z5IiwiYXV0aFR5cGUiOiJlbWFpbCIsImlkZW50aWZpZXIiOiJyb2hpdC5yYWpzdXJ5YTEwQGdtYWlsLmNvbSIsImVtYWlsIjoicm9oaXQucmFqc3VyeWExMEBnbWFpbC5jb20iLCJkaXNwbGF5TmFtZSI6InJvaGl0LnJhanN1cnlhMTBAZ21haWwuY29tIiwicm9sZSI6InBhcmFfdXNlciIsImhhc1dhbGxldCI6ZmFsc2UsImlhdCI6MTc1OTA2NTUxNCwiZXhwIjoxNzU5NjcwMzE0fQ.8LrxeD2sicGlH49IxZT-PsDmQqCO7MXgIHXnlKRp5pc";

const JWT_SECRET = "your-secret-key-here";

try {
  const decoded = jwt.verify(token, JWT_SECRET);
  console.log('✅ JWT verification successful:');
  console.log(JSON.stringify(decoded, null, 2));
} catch (error) {
  console.log('❌ JWT verification failed:');
  console.log(error.message);
}



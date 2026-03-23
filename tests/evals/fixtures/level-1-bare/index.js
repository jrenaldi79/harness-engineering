const express = require('express');
const app = express();

// Hardcoded secret (should be caught by code quality check)
const API_KEY = 'sk-ant-api03-fake-key-for-testing-purposes-only';

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(3000);

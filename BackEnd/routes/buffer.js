const express = require('express');
const { Readable } = require('stream');
const { getGoogleDriveClient } = require('../config/googleDrive');
const { protect } = require('../controllers/authController');

const router = express.Router();

const BUFFER_COLUMNS = [
  'caregiving',
  'coping_index',
  'coping_support_note',
  'degree_level',
  'funding_status',
  'primary_stressor_note',
  'productivity_index',
  'program_year',
  'stressor_index',
  'study_mode',
  'supervisor_freq',
  'weekly_hours',
  'gad7_score',
  'overall_wellbeing',
  'phq9_score',
  'pss_score',
];

const escapeCsvValue = (value) => {
  if (value === undefined || value === null) {
    return '';
  }

  const normalized = String(value);

  if (/[",\r\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
};

const toCsvRow = (record) => BUFFER_COLUMNS.map((key) => escapeCsvValue(record[key])).join(',');

const findBufferFileId = async (drive) => {
  if (process.env.GOOGLE_DRIVE_BUFFER_FILE_ID) {
    return process.env.GOOGLE_DRIVE_BUFFER_FILE_ID;
  }

  const fileName = process.env.GOOGLE_DRIVE_BUFFER_FILE_NAME || 'buffer.csv';
  const escapedName = fileName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const response = await drive.files.list({
    q: `name='${escapedName}' and trashed=false`,
    fields: 'files(id, name, modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: 2,
  });
  const files = response.data.files || [];

  if (!files.length) {
    throw new Error(`${fileName} was not found in Google Drive`);
  }

  if (files.length > 1) {
    console.warn(`Multiple ${fileName} files found in Drive; using the most recently modified file.`);
  }

  return files[0].id;
};

const downloadCsv = async (drive, fileId) => {
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'text' }
  );

  return typeof response.data === 'string' ? response.data : String(response.data || '');
};

const uploadCsv = async (drive, fileId, csv) => {
  // Drive has no append primitive for CSV files, so rewrite the small buffer file.
  await drive.files.update({
    fileId,
    media: {
      mimeType: 'text/csv',
      body: Readable.from([csv]),
    },
  });
};

router.post('/feedback', protect, async (req, res) => {
  try {
    const record = req.body && typeof req.body === 'object' ? req.body : {};
    const drive = getGoogleDriveClient();
    const fileId = await findBufferFileId(drive);
    const currentCsv = await downloadCsv(drive, fileId);
    const row = toCsvRow(record);
    const baseCsv = currentCsv || `${BUFFER_COLUMNS.join(',')}\n`;
    const separator = baseCsv.endsWith('\n') ? '' : '\n';
    const updatedCsv = `${baseCsv}${separator}${row}\n`;

    await uploadCsv(drive, fileId, updatedCsv);

    res.status(201).json({ message: 'Feedback appended to buffer.csv' });
  } catch (err) {
    console.error('Drive buffer append error:', err.message);
    res.status(500).json({ error: 'Unable to append feedback to buffer.csv' });
  }
});

module.exports = router;

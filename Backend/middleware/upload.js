const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const maxSize = (parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10)) * 1024 * 1024;

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4',
    'application/pdf', 'application/zip', 'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword', 'application/vnd.android.package-archive',
    'text/plain'
  ];

  if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: maxSize },
  fileFilter
});

function getFileExtension(filename) {
  return path.extname(filename).toLowerCase();
}

function generateFileName(originalName) {
  const ext = getFileExtension(originalName) || '';
  return `${uuidv4()}${ext}`;
}

module.exports = { upload, generateFileName, getFileExtension };

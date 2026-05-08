const multer = require('multer');

const cloudinary = require('../config/cloudinary');
const { query } = require('../config/db');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;        // 5 MB

// Multer config — keeps uploaded file in memory as a Buffer (no temp file).
// limits.fileSize → multer rejects > 5MB before we ever see the file.
// fileFilter   → multer rejects bad MIME types likewise.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`Only ${ALLOWED_MIME_TYPES.join(', ')} allowed`));
    }
    cb(null, true);
  },
});

// Wrap multer's middleware so file errors return a clean 400 (instead of 500
// from the global error handler).
function photoUploadMiddleware(req, res, next) {
  upload.single('photo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: `File too large (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB)`,
        });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}

// Cloudinary's SDK exposes upload_stream — give it a buffer, get back the upload
// result. Wrap in a Promise so we can `await` it instead of nesting callbacks.
function uploadBufferToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
}


// POST /api/pgs/:id/photos — auth required; multipart/form-data with 'photo' field.
async function uploadPhoto(req, res, next) {
  try {
    const pgId = parseInt(req.params.id, 10);
    if (!Number.isInteger(pgId) || pgId < 1) {
      return res.status(400).json({ error: 'Invalid PG id' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'photo file is required' });
    }

    // Step 1 — upload to Cloudinary. We do this BEFORE the DB insert so we have
    // the URL + public_id to store. Folder keeps the cloud organised.
    const result = await uploadBufferToCloudinary(req.file.buffer, {
      folder: 'pgpeer/pg_photos',
      resource_type: 'image',
    });

    // Step 2 — insert metadata into our DB. If the PG doesn't exist (FK 23503),
    // we have an orphan upload in Cloudinary. Clean it up.
    let photo;
    try {
      const insertResult = await query(
        `INSERT INTO pg_photos (pg_id, photo_url, cloudinary_public_id, uploaded_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, pg_id, photo_url, uploaded_by, created_at`,
        [pgId, result.secure_url, result.public_id, req.user.id]
      );
      photo = insertResult.rows[0];
    } catch (err) {
      if (err.code === '23503') {
        // Best-effort cleanup of orphan Cloudinary asset; ignore secondary failures.
        await cloudinary.uploader.destroy(result.public_id).catch(() => {});
        return res.status(404).json({ error: 'PG not found' });
      }
      throw err;
    }

    return res.status(201).json({ photo });
  } catch (err) {
    next(err);
  }
}


module.exports = { uploadPhoto, photoUploadMiddleware };

import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import os from 'os'
import { upload, getJob, listJobs, confirm, cancel } from '../controllers/import.controller'
import { requireRole } from '../middleware/require-role'
import { EXCEL_UPLOAD } from '../utils/excel-upload'

const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (_req, file, cb) => {
    cb(null, `import-${Date.now()}${path.extname(file.originalname)}`)
  },
})

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: EXCEL_UPLOAD.MAX_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === EXCEL_UPLOAD.ALLOWED_EXT) {
      cb(null, true)
    } else {
      cb(new Error(`Chỉ chấp nhận file ${EXCEL_UPLOAD.ALLOWED_EXT}. File của bạn có định dạng "${ext || 'không rõ'}".`))
    }
  },
})

const router = Router()

router.post('/upload', requireRole('admin', 'manager'), (req, res, next) => {
  uploadMiddleware.single('file')(req, res, (err) => {
    if (!err) return next()
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: `File vượt quá giới hạn ${EXCEL_UPLOAD.MAX_SIZE_BYTES / 1024 / 1024}MB.` })
    } else {
      res.status(400).json({ error: (err as Error).message || 'Upload file thất bại.' })
    }
  })
}, upload)

router.get('/jobs', listJobs)
router.get('/jobs/:job_id', getJob)
router.post('/jobs/:job_id/confirm', requireRole('admin', 'manager'), confirm)
router.post('/jobs/:job_id/cancel', requireRole('admin', 'manager'), cancel)

export default router

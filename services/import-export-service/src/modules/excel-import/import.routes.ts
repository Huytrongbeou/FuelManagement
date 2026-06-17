import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import os from 'os'
import { upload, getJob, listJobs, confirm, cancel } from './import.controller'

const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (_req, file, cb) => {
    cb(null, `import-${Date.now()}${path.extname(file.originalname)}`)
  },
})

const upload_mw = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10)) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.includes('spreadsheet') || file.originalname.endsWith('.xlsx')) {
      cb(null, true)
    } else {
      cb(new Error('Only .xlsx files are accepted'))
    }
  },
})

const router = Router()

// Excel import
router.post('/upload', upload_mw.single('file'), upload)
router.get('/jobs', listJobs)
router.get('/jobs/:job_id', getJob)
router.post('/jobs/:job_id/confirm', confirm)
router.post('/jobs/:job_id/cancel', cancel)

export default router

const { randomUUID } = require('crypto')
const { sendError } = require('../http/responses')
const { isValidEmail } = require('../utils/validation')
const { db: defaultDb } = require('../db/knex')
const { gcsService: defaultGcsService } = require('../services/gcsService')

const ALLOWED_AVATAR_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const WIDGET_PREFERENCE_KEYS = ['suppliers', 'contracts', 'templates']

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function extFromMime(mime) {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  return null
}

function validateWidgetPreferences(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false
  for (const key of Object.keys(value)) {
    if (!WIDGET_PREFERENCE_KEYS.includes(key)) return false
    if (typeof value[key] !== 'boolean') return false
  }
  return true
}

function createAvatarUploadMiddleware({ multerLib } = {}) {
  const multer = multerLib ?? require('multer')
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_AVATAR_BYTES }
  }).single('avatar')
}

function createAvatarUploadRouteHandler(options = {}) {
  const upload = createAvatarUploadMiddleware(options)
  return (req, res, next) => {
    upload(req, res, (err) => {
      if (!err) return next()
      if (err.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'La imagen no puede superar 2 MB.'
        })
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return sendError(res, {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Debe enviar una imagen de avatar.'
        })
      }
      return sendError(res, {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'No se pudo procesar la imagen enviada.'
      })
    })
  }
}

function createMeController({ db = defaultDb, gcsService = defaultGcsService } = {}) {
  return {
    putProfile: async (req, res) => {
      const { contact_email: contactEmail, widget_preferences: widgetPreferences } = req.body ?? {}
      const hasContactEmail = contactEmail !== undefined
      const hasWidgetPreferences = widgetPreferences !== undefined

      if (!hasContactEmail && !hasWidgetPreferences) {
        return sendError(res, {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Debe indicar al menos un campo para actualizar.'
        })
      }

      if (hasContactEmail) {
        if (typeof contactEmail !== 'string' || !isValidEmail(contactEmail)) {
          return sendError(res, {
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'El correo de contacto no tiene un formato válido.'
          })
        }
      }

      if (hasWidgetPreferences && !validateWidgetPreferences(widgetPreferences)) {
        return sendError(res, {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Las preferencias de widgets no son válidas.'
        })
      }

      const update = { updated_at: db.fn.now() }
      if (hasContactEmail) update.contact_email = contactEmail.trim()
      if (hasWidgetPreferences) update.widget_preferences = widgetPreferences

      const updated = await db('user_profile').where({ user_id: req.auth.userId }).update(update)
      if (!updated) {
        return sendError(res, {
          status: 404,
          code: 'PROFILE_NOT_FOUND',
          message: 'No se encontró el perfil del usuario.'
        })
      }

      return res.status(200).json({ ok: true })
    },

    postAvatar: async (req, res) => {
      const file = req.file
      if (!file || !file.buffer) {
        return sendError(res, {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'Debe enviar una imagen de avatar.'
        })
      }

      if (!ALLOWED_AVATAR_MIMES.has(file.mimetype)) {
        return sendError(res, {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'El archivo debe ser una imagen JPEG, PNG o WebP.'
        })
      }

      if (file.size > MAX_AVATAR_BYTES) {
        return sendError(res, {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'La imagen no puede superar 2 MB.'
        })
      }

      const profile = await db('user_profile')
        .select('id', 'avatar_gcs_path')
        .where({ user_id: req.auth.userId })
        .first()

      if (!profile) {
        return sendError(res, {
          status: 404,
          code: 'PROFILE_NOT_FOUND',
          message: 'No se encontró el perfil del usuario.'
        })
      }

      const ext = extFromMime(file.mimetype)
      if (!ext) {
        return sendError(res, {
          status: 400,
          code: 'VALIDATION_ERROR',
          message: 'El archivo debe ser una imagen JPEG, PNG o WebP.'
        })
      }

      const gcsPath = `avatars/${profile.id}/${randomUUID()}.${ext}`

      if (profile.avatar_gcs_path) {
        try {
          await gcsService.deleteFile({ gcsPath: profile.avatar_gcs_path })
        } catch {
          // best-effort cleanup
        }
      }

      await gcsService.uploadBuffer({
        buffer: file.buffer,
        gcsPath,
        contentType: file.mimetype
      })

      await db('user_profile').where({ id: profile.id }).update({ avatar_gcs_path: gcsPath })

      const avatarUrl = await gcsService.getSignedUrl({ gcsPath, expiresInMinutes: 1440 })
      return res.status(200).json({ ok: true, avatar_url: avatarUrl })
    }
  }
}

module.exports = { createMeController, createAvatarUploadMiddleware, createAvatarUploadRouteHandler }

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { PageShell } from '../components/PageShell'
import { updateMyProfile, uploadMyAvatar } from '../api/meApi'
import defaultAvatarUrl from '../assets/images/user-avatar-default.svg'
import {
  selectAvatarUrl,
  selectContactEmail,
  selectEnrichedEmail,
  selectEnrichedName,
  selectEnrichedProfile,
  selectWidgetPreferences,
  updateProfileData
} from '../store/authSlice'
import '../styles/shared-form.css'
import '../styles/my-profile.css'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024

function resolveWidgetPrefs(raw) {
  return {
    suppliers: raw?.suppliers !== false,
    contracts: raw?.contracts !== false,
    templates: raw?.templates !== false
  }
}

export function MyProfilePage() {
  const dispatch = useDispatch()
  const loginEmail = useSelector(selectEnrichedEmail)
  const name = useSelector(selectEnrichedName)
  const profile = useSelector(selectEnrichedProfile)
  const avatarUrl = useSelector(selectAvatarUrl)
  const storedContactEmail = useSelector(selectContactEmail)
  const widgetPreferences = useSelector(selectWidgetPreferences)

  const roleLabel = profile?.label ?? profile?.code ?? '—'
  const initialContactEmail = storedContactEmail ?? loginEmail ?? ''
  const breadcrumb = useMemo(() => [{ label: 'Mi perfil' }], [])

  const [contactEmail, setContactEmail] = useState(initialContactEmail)
  const [widgetPrefs, setWidgetPrefs] = useState(() => resolveWidgetPrefs(widgetPreferences))
  const [previewUrl, setPreviewUrl] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState(null)
  const [contactSaving, setContactSaving] = useState(false)
  const [contactMessage, setContactMessage] = useState(null)
  const [widgetError, setWidgetError] = useState(null)

  const fileInputRef = useRef(null)
  const widgetDebounceRef = useRef(null)
  const widgetPrefsRef = useRef(widgetPrefs)

  useEffect(() => {
    setContactEmail(storedContactEmail ?? loginEmail ?? '')
  }, [storedContactEmail, loginEmail])

  useEffect(() => {
    setWidgetPrefs(resolveWidgetPrefs(widgetPreferences))
  }, [widgetPreferences])

  useEffect(() => {
    widgetPrefsRef.current = widgetPrefs
  }, [widgetPrefs])

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
      if (widgetDebounceRef.current) clearTimeout(widgetDebounceRef.current)
    }
  }, [previewUrl])

  const displayAvatar = previewUrl ?? avatarUrl ?? defaultAvatarUrl
  const isPlaceholderAvatar = !previewUrl && !avatarUrl

  const saveWidgetPreferences = useCallback(
    async (prefs) => {
      setWidgetError(null)
      const res = await updateMyProfile({ widget_preferences: prefs }, {})
      if (!res.ok) {
        setWidgetError(res.message || 'No se pudieron guardar las preferencias.')
        return
      }
      dispatch(updateProfileData({ widgetPreferences: prefs }))
    },
    []
  )

  const scheduleWidgetSave = useCallback(
    (nextPrefs) => {
      if (widgetDebounceRef.current) clearTimeout(widgetDebounceRef.current)
      widgetDebounceRef.current = setTimeout(() => {
        saveWidgetPreferences(nextPrefs)
      }, 800)
    },
    [saveWidgetPreferences]
  )

  function onWidgetToggle(key) {
    const next = { ...widgetPrefsRef.current, [key]: !widgetPrefsRef.current[key] }
    setWidgetPrefs(next)
    scheduleWidgetSave(next)
  }

  async function onAvatarSelected(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setAvatarError(null)

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('La imagen no puede superar 2 MB.')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl((prev) => {
      if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
      return objectUrl
    })
    setAvatarUploading(true)

    const res = await uploadMyAvatar(file, {})
    setAvatarUploading(false)

    if (!res.ok) {
      setAvatarError(res.message || 'No se pudo subir la imagen.')
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        return null
      })
      return
    }

    const newUrl =
      res.body && typeof res.body === 'object' && typeof res.body.avatar_url === 'string'
        ? res.body.avatar_url
        : null
    if (newUrl) {
      dispatch(updateProfileData({ avatarUrl: newUrl }))
      setPreviewUrl((prev) => {
        if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev)
        return null
      })
    }
  }

  async function onSaveContactEmail() {
    setContactMessage(null)
    setContactSaving(true)
    const res = await updateMyProfile({ contact_email: contactEmail.trim() }, {})
    setContactSaving(false)
    if (!res.ok) {
      setContactMessage({ type: 'error', text: res.message || 'No se pudo guardar el correo.' })
      return
    }
    dispatch(updateProfileData({ contactEmail: contactEmail.trim() }))
    setContactMessage({ type: 'success', text: 'Correo de contacto guardado.' })
  }

  return (
    <PageShell breadcrumb={breadcrumb} hideHeader className="my-profile-page">
      <div className="ph-card clause-card my-profile-card">
        <section className="my-profile-section" aria-labelledby="my-profile-avatar-title">
          <h2 id="my-profile-avatar-title" className="my-profile-section__title">
            Foto de perfil
          </h2>
          <div className="my-profile-avatar-row">
            <button
              type="button"
              className="my-profile-avatar-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              aria-label="Cambiar foto de perfil"
            >
              <span className="my-profile-avatar-frame">
                <img
                  className={`my-profile-avatar${isPlaceholderAvatar ? ' my-profile-avatar--placeholder' : ''}`}
                  src={displayAvatar}
                  alt=""
                  width={80}
                  height={80}
                />
                {avatarUploading ? <span className="my-profile-avatar__spinner">…</span> : null}
              </span>
            </button>
            <div className="my-profile-avatar-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
              >
                Cambiar foto
              </button>
              <p className="my-profile-hint">JPEG, PNG o WebP. Máximo 2 MB.</p>
              {avatarError ? <p className="my-profile-error">{avatarError}</p> : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="my-profile-file-input"
              onChange={onAvatarSelected}
            />
          </div>
        </section>

        <section className="my-profile-section" aria-labelledby="my-profile-data-title">
          <h2 id="my-profile-data-title" className="my-profile-section__title">
            Datos personales
          </h2>
          <div className="clause-form">
            <div className="clause-form-row clause-form-row--two-equal">
              <div className="clause-form-col">
                <div className="clause-label">Nombre</div>
                <input className="clause-input clause-input--readonly" readOnly tabIndex={-1} value={name ?? ''} />
              </div>
              <div className="clause-form-col">
                <div className="clause-label">Rol</div>
                <input
                  className="clause-input clause-input--readonly"
                  readOnly
                  tabIndex={-1}
                  value={roleLabel}
                />
              </div>
            </div>
            <div className="clause-form-row">
              <div className="clause-form-col">
                <div className="clause-label">Email de contacto</div>
                <div className="my-profile-inline-save">
                  <input
                    className="clause-input"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="correo@empresa.cl"
                  />
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={onSaveContactEmail}
                    disabled={contactSaving}
                  >
                    {contactSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
                {contactMessage ? (
                  <p
                    className={
                      contactMessage.type === 'error' ? 'my-profile-error' : 'my-profile-success'
                    }
                  >
                    {contactMessage.text}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="my-profile-section" aria-labelledby="my-profile-widgets-title">
          <h2 id="my-profile-widgets-title" className="my-profile-section__title">
            Widgets del Dashboard
          </h2>
          <p className="my-profile-hint">
            Selecciona qué información quieres ver en tu pantalla de inicio
          </p>
          <div className="my-profile-widgets">
            <label className="my-profile-checkbox">
              <input
                type="checkbox"
                checked={widgetPrefs.suppliers}
                onChange={() => onWidgetToggle('suppliers')}
              />
              <span>Proveedores</span>
            </label>
            <label className="my-profile-checkbox">
              <input
                type="checkbox"
                checked={widgetPrefs.contracts}
                onChange={() => onWidgetToggle('contracts')}
              />
              <span>Contratos</span>
            </label>
            <label className="my-profile-checkbox">
              <input
                type="checkbox"
                checked={widgetPrefs.templates}
                onChange={() => onWidgetToggle('templates')}
              />
              <span>Plantillas</span>
            </label>
          </div>
          {widgetError ? <p className="my-profile-error">{widgetError}</p> : null}
        </section>
      </div>
    </PageShell>
  )
}

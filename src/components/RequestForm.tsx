import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, FileImage, FilePlus2, MapPin, Upload, X } from 'lucide-react'
import { SERVICE_CATEGORIES, readableError } from '../lib/format'
import { supabase } from '../lib/supabase'
import RequestLocationPicker from './RequestLocationPicker'

const STORAGE_BUCKET = 'request-attachments'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function RequestForm({ userId, onSubmitted }: { userId: string; onSubmitted: () => void }) {
  const [category, setCategory] = useState<string>(SERVICE_CATEGORIES[0])
  const [location, setLocation] = useState('')
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null)
  const [description, setDescription] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [submittedReference, setSubmittedReference] = useState('')
  const [attachmentNote, setAttachmentNote] = useState('')

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    setError('')
    const file = event.target.files?.[0]
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImage(null)
      event.target.value = ''
      setError('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImage(null)
      event.target.value = ''
      setError('The image must be 5 MB or smaller.')
      return
    }
    setImage(file)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setAttachmentNote('')
    if (!supabase) {
      setError('Supabase is not connected. Add the project URL and anon key, then try again.')
      return
    }
    if (location.trim().length < 3) {
      setError('Please enter a location with at least 3 characters.')
      return
    }
    if (description.trim().length < 12) {
      setError('Please add a little more detail (at least 12 characters).')
      return
    }

    setBusy(true)
    try {
      const { data: request, error: insertError } = await supabase
        .from('requests')
        .insert({
          user_id: userId,
          category,
          location: location.trim(),
          latitude: coordinates?.[0] ?? null,
          longitude: coordinates?.[1] ?? null,
          description: description.trim(),
        })
        .select('id, reference_number')
        .single()
      if (insertError) throw insertError

      if (image) {
        const extension = image.type === 'image/jpeg' ? 'jpg' : image.type === 'image/png' ? 'png' : 'webp'
        const imagePath = `${userId}/${request.id}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(imagePath, image, { contentType: image.type, cacheControl: '3600', upsert: false })

        if (uploadError) {
          setAttachmentNote('Your request was saved, but the image could not be uploaded. You can still track your request below.')
        } else {
          const { error: updateError } = await supabase
            .from('requests')
            .update({ image_path: imagePath })
            .eq('id', request.id)
          if (updateError) {
            await supabase.storage.from(STORAGE_BUCKET).remove([imagePath])
            setAttachmentNote('Your request was saved, but its image could not be linked. You can still track your request below.')
          }
        }
      }
      setSubmittedReference(request.reference_number)
    } catch (caught) {
      setError(readableError(caught))
    } finally {
      setBusy(false)
    }
  }

  if (submittedReference) {
    return (
      <section className="submission-success">
        <div className="success-icon"><CheckCircle2 size={28} /></div>
        <p className="eyebrow">REQUEST RECEIVED</p>
        <h2>Your request is in the queue.</h2>
        <p>Keep this reference number safe. You can use it when following up.</p>
        <div className="reference-display"><span>YOUR REFERENCE</span><strong>{submittedReference}</strong></div>
        <div className="success-status"><span className="status-dot status-pending" /> Status <strong>Pending</strong></div>
        {attachmentNote && <div className="notice notice-warning" role="status">{attachmentNote}</div>}
        <button className="button button-primary" onClick={onSubmitted}>Track my requests <ArrowLeft size={16} className="arrow-forward" /></button>
      </section>
    )
  }

  return (
    <section className="form-layout">
      <div className="form-card">
        <div className="form-card-heading"><span className="form-card-icon"><FilePlus2 size={20} /></span><div><h2>Request details</h2><p>Fields marked with <span className="required-star">*</span> are required.</p></div></div>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <form className="request-form" onSubmit={handleSubmit}>
          <label className="field-label">Service category <span className="required-star">*</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} required>
              {SERVICE_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="field-label">Where is the issue? <span className="required-star">*</span>
            <span className="input-with-icon"><MapPin size={17} /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Area, road, village or nearby landmark" required minLength={3} maxLength={160} /></span>
            <small className="field-hint">A nearby landmark helps the right team find it.</small>
          </label>
          <div className="map-picker-field">
            <div className="map-picker-title">Optional map pin</div>
            <RequestLocationPicker value={coordinates} onChange={setCoordinates} />
          </div>
          <label className="field-label">Describe the request <span className="required-star">*</span>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is happening, and what would help? Please avoid sharing sensitive personal details." required minLength={12} maxLength={1200} rows={5} />
            <small className="field-hint">{description.length}/1,200 characters (minimum 12).</small>
          </label>
          <div className="field-label">Photo <span className="optional-label">OPTIONAL</span>
            <label className={`upload-box ${image ? 'has-file' : ''}`}>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} aria-label="Attach an optional image" />
              {image ? <><FileImage size={20} /><span><strong>{image.name}</strong><small>{(image.size / 1024 / 1024).toFixed(1)} MB · Ready to upload</small></span><button type="button" className="remove-file" aria-label="Remove image" onClick={(event) => { event.preventDefault(); setImage(null) }}><X size={17} /></button></> : <><Upload size={20} /><span><strong>Choose a photo</strong><small>JPG, PNG or WebP · up to 5 MB</small></span><span className="upload-browse">Browse</span></>}
            </label>
          </div>
          <div className="form-security-note"><CheckCircle2 size={16} /><span>Your request is visible to you and authorised county staff only.</span></div>
          <div className="form-actions">
            <button className="button button-quiet" type="button" onClick={onSubmitted}>Cancel</button>
            <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Sending request…' : 'Submit request'} {!busy && <ArrowLeft size={16} className="arrow-forward" />}</button>
          </div>
        </form>
      </div>
      <aside className="form-side-note"><div className="side-note-number">01 <span>—</span> 03</div><h3>What happens next?</h3><p>We’ll give your request a reference number straight away. County staff will review it and update the status as work progresses.</p><div className="mini-status-list"><div><span className="status-dot status-pending" /> Submitted <small>We’ve received it</small></div><div><span className="status-dot status-progress" /> In progress <small>A team is working on it</small></div><div><span className="status-dot status-resolved" /> Resolved <small>The issue is addressed</small></div></div></aside>
    </section>
  )
}

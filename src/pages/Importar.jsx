import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { importarEstadosCuenta } from '../lib/importacion'

export default function Importar({ onImportado }) {
  const [cuentas, setCuentas] = useState([])
  const [cuentaId, setCuentaId] = useState('')
  const [files, setFiles] = useState([])
  const [cargando, setCargando] = useState(false)
  const [progreso, setProgreso] = useState({ actual: 0, total: 0 })
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(null)

  useEffect(() => {
    const cargarCuentas = async () => {
      const { data, error } = await supabase
        .from('cuentas')
        .select('id, nombre, banco')
        .eq('activa', true)
        .order('nombre')

      if (error) {
        setError('No se pudieron cargar las cuentas: ' + error.message)
      } else {
        setCuentas(data)
      }
    }
    cargarCuentas()
  }, [])

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || [])
    const pdfs = selected.filter((f) => f.type === 'application/pdf')
    if (pdfs.length !== selected.length) {
      setError('Algunos archivos no son PDF y fueron ignorados')
    } else {
      setError(null)
    }
    setFiles((prev) => [...prev, ...pdfs])
    e.target.value = ''
  }

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleImportar = async () => {
    if (!cuentaId) {
      setError('Selecciona una cuenta antes de importar')
      return
    }
    if (files.length === 0) return

    setCargando(true)
    setError(null)
    setExito(null)

    try {
      const filas = await importarEstadosCuenta(files, cuentaId, setProgreso)
      setExito(`${filas.length} transacciones importadas. Revisa la pestaña "Pendientes" para confirmarlas.`)
      setFiles([])
      if (onImportado) onImportado()
    } catch (err) {
      setError(err.message || 'Error al importar los estados de cuenta')
    } finally {
      setCargando(false)
      setProgreso({ actual: 0, total: 0 })
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Importar estado de cuenta</h2>
      <p style={styles.subtitle}>Selecciona la cuenta y sube uno o varios PDFs de ese banco.</p>

      <label style={styles.label}>Cuenta</label>
      <select
        value={cuentaId}
        onChange={(e) => setCuentaId(e.target.value)}
        style={styles.select}
      >
        <option value="">Selecciona una cuenta...</option>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>

      <input
        type="file"
        accept=".pdf"
        multiple
        onChange={handleFileChange}
        id="file-upload"
        style={{ display: 'none' }}
      />
      <label htmlFor="file-upload" style={styles.uploadButton}>
        {files.length === 0 ? 'Seleccionar PDFs' : 'Agregar más PDFs'}
      </label>

      {files.length > 0 && (
        <div style={styles.fileList}>
          {files.map((f, idx) => (
            <div key={idx} style={styles.fileItem}>
              <span>{f.name}</span>
              <button onClick={() => removeFile(idx)} style={styles.removeButton}>✕</button>
            </div>
          ))}
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}
      {exito && <div style={styles.exito}>{exito}</div>}

      {files.length > 0 && (
        <button
          onClick={handleImportar}
          disabled={cargando || !cuentaId}
          style={styles.analyzeButton}
        >
          {cargando
            ? `Procesando ${progreso.actual}/${progreso.total}...`
            : `Importar ${files.length} documento${files.length > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  )
}

const styles = {
  container: { maxWidth: '480px', margin: '0 auto', padding: '24px' },
  title: { fontSize: '20px', margin: '0 0 4px 0', color: '#f8fafc' },
  subtitle: { fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0' },
  label: { fontSize: '13px', color: '#cbd5e1', display: 'block', marginBottom: '6px' },
  select: {
    width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #334155',
    background: '#0f172a', color: '#f8fafc', fontSize: '14px', marginBottom: '16px',
  },
  uploadButton: {
    display: 'block', textAlign: 'center', padding: '12px', borderRadius: '8px',
    border: '1px dashed #475569', color: '#60a5fa', cursor: 'pointer', fontSize: '14px',
  },
  fileList: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' },
  fileItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#1e293b', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', color: '#e2e8f0',
  },
  removeButton: { background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' },
  analyzeButton: {
    width: '100%', marginTop: '16px', padding: '12px', borderRadius: '8px', border: 'none',
    background: '#22c55e', color: '#0f172a', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
  },
  error: {
    marginTop: '12px', background: '#7f1d1d', color: '#fecaca', padding: '8px 10px',
    borderRadius: '6px', fontSize: '13px',
  },
  exito: {
    marginTop: '12px', background: '#14532d', color: '#bbf7d0', padding: '8px 10px',
    borderRadius: '6px', fontSize: '13px',
  },
}

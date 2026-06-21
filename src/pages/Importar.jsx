import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { importarEstadosCuenta } from '../lib/importacion'
import { UploadCloud, X } from 'lucide-react'

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

      if (error) setError('No se pudieron cargar las cuentas: ' + error.message)
      else setCuentas(data)
    }
    cargarCuentas()
  }, [])

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || [])
    const pdfs = selected.filter((f) => f.type === 'application/pdf')
    if (pdfs.length !== selected.length) setError('Algunos archivos no son PDF y fueron ignorados')
    else setError(null)
    setFiles((prev) => [...prev, ...pdfs])
    e.target.value = ''
  }

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx))

  const handleImportar = async () => {
    if (!cuentaId) { setError('Selecciona una cuenta antes de importar'); return }
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

  const selectCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent'

  return (
    <div className="max-w-lg mx-auto animate-slide-in">
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Importar estado de cuenta</h2>
      <p className="text-sm text-gray-500 mb-5">Selecciona la cuenta y sube uno o varios PDFs de ese banco.</p>

      <div className="card space-y-4">
        <div>
          <label className="label-field">Cuenta</label>
          <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} className={selectCls}>
            <option value="">Selecciona una cuenta...</option>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.banco}</option>)}
          </select>
        </div>

        <input type="file" accept=".pdf" multiple onChange={handleFileChange} id="file-upload" className="hidden" />
        <label htmlFor="file-upload" className="flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-primary-400 hover:text-primary-600 cursor-pointer transition-colors">
          <UploadCloud className="h-7 w-7" />
          <span className="text-sm">{files.length === 0 ? 'Seleccionar PDFs' : 'Agregar más PDFs'}</span>
        </label>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
                <span className="truncate">{f.name}</span>
                <button onClick={() => removeFile(idx)} className="text-danger-500 hover:text-danger-700 ml-2">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <div className="alert-danger text-sm">{error}</div>}
        {exito && <div className="alert-success text-sm">{exito}</div>}

        {files.length > 0 && (
          <button onClick={handleImportar} disabled={cargando || !cuentaId} className="btn-primary w-full disabled:opacity-60">
            {cargando
              ? `Procesando ${progreso.actual}/${progreso.total}...`
              : `Importar ${files.length} documento${files.length > 1 ? 's' : ''}`}
          </button>
        )}
      </div>
    </div>
  )
}

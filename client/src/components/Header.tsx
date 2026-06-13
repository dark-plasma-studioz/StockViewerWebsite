import { useState, useRef } from 'react';
import { RefreshCw, Download, Upload, PlusCircle, Trash2, Edit2, Check, X } from 'lucide-react';
import { usePortfolioStore } from '../store/portfolioStore';
import { buildExportData, downloadJSON, parseImportFile } from '../lib/exportImport';
import type { ExportData } from '../types';

interface HeaderProps {
  onAddHolding: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export function Header({ onAddHolding, onRefresh, isLoading }: HeaderProps) {
  const profiles = usePortfolioStore((s) => s.profiles);
  const activeProfileId = usePortfolioStore((s) => s.activeProfileId);
  const holdings = usePortfolioStore((s) => s.holdings);
  const snapshots = usePortfolioStore((s) => s.snapshots);
  const addProfile = usePortfolioStore((s) => s.addProfile);
  const updateProfile = usePortfolioStore((s) => s.updateProfile);
  const deleteProfile = usePortfolioStore((s) => s.deleteProfile);
  const setActiveProfile = usePortfolioStore((s) => s.setActiveProfile);
  const importData = usePortfolioStore((s) => s.importData);

  const [addingProfile, setAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [pendingImport, setPendingImport] = useState<ExportData | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleAddProfile() {
    const name = newProfileName.trim();
    if (!name) return;
    addProfile(name);
    setNewProfileName('');
    setAddingProfile(false);
  }

  function handleStartEdit(id: string, currentName: string) {
    setEditingProfileId(id);
    setEditingName(currentName);
  }

  function handleSaveEdit() {
    if (editingProfileId && editingName.trim()) {
      updateProfile(editingProfileId, editingName.trim());
    }
    setEditingProfileId(null);
  }

  function handleExport() {
    downloadJSON(buildExportData(profiles, holdings, snapshots));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImportError(null);
    try {
      const data = await parseImportFile(file);
      setPendingImport(data);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Invalid file');
    }
  }

  function confirmImport(mode: 'merge' | 'replace') {
    if (!pendingImport) return;
    importData(pendingImport, mode);
    setPendingImport(null);
  }

  return (
    <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
        {/* App title */}
        <span className="text-lg font-bold text-emerald-400 shrink-0">
          Family Portfolio
        </span>

        {/* Profile tabs */}
        <nav className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center group">
              {editingProfileId === p.id ? (
                <div className="flex items-center gap-1">
                  <input
                    className="input w-28 h-7 text-xs py-1"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') setEditingProfileId(null);
                    }}
                    autoFocus
                  />
                  <button onClick={handleSaveEdit} className="text-emerald-400 hover:text-emerald-300 p-0.5">
                    <Check size={14} />
                  </button>
                  <button onClick={() => setEditingProfileId(null)} className="text-gray-500 hover:text-gray-300 p-0.5">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setActiveProfile(p.id)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    activeProfileId === p.id
                      ? 'bg-emerald-600 text-white'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  {p.name}
                </button>
              )}
              {activeProfileId === p.id && editingProfileId !== p.id && (
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
                  <button
                    onClick={() => handleStartEdit(p.id, p.name)}
                    className="text-gray-500 hover:text-gray-300 p-0.5"
                    title="Rename profile"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete profile "${p.name}" and all its holdings?`)) {
                        deleteProfile(p.id);
                      }
                    }}
                    className="text-gray-500 hover:text-red-400 p-0.5"
                    title="Delete profile"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {addingProfile ? (
            <div className="flex items-center gap-1">
              <input
                className="input w-28 h-7 text-xs py-1"
                placeholder="Profile name"
                value={newProfileName}
                onChange={(e) => setNewProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddProfile();
                  if (e.key === 'Escape') setAddingProfile(false);
                }}
                autoFocus
              />
              <button onClick={handleAddProfile} className="text-emerald-400 hover:text-emerald-300 p-0.5">
                <Check size={14} />
              </button>
              <button onClick={() => setAddingProfile(false)} className="text-gray-500 hover:text-gray-300 p-0.5">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingProfile(true)}
              className="text-gray-500 hover:text-gray-300 px-2 py-1 text-xs flex items-center gap-1"
              title="Add profile"
            >
              <PlusCircle size={14} />
              Add profile
            </button>
          )}
        </nav>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="btn-secondary text-xs"
            title="Refresh prices"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button onClick={handleExport} className="btn-secondary text-xs" title="Export data">
            <Download size={14} />
            Export
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary text-xs"
            title="Import data"
          >
            <Upload size={14} />
            Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />

          {activeProfileId && (
            <button onClick={onAddHolding} className="btn-primary text-xs">
              <PlusCircle size={14} />
              Add holding
            </button>
          )}
        </div>
      </div>

      {/* Import confirmation banner */}
      {pendingImport && (
        <div className="bg-yellow-900/40 border-t border-yellow-700/50 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center gap-4 flex-wrap">
            <span className="text-yellow-300 text-sm">
              Import contains {pendingImport.profiles.length} profile(s) and{' '}
              {pendingImport.holdings.length} holding(s). How should we import it?
            </span>
            <div className="flex gap-2">
              <button onClick={() => confirmImport('merge')} className="btn-secondary text-xs">
                Merge (keep existing, overwrite by ID)
              </button>
              <button
                onClick={() => {
                  if (confirm('This will replace ALL existing data. Are you sure?')) {
                    confirmImport('replace');
                  }
                }}
                className="btn-danger text-xs"
              >
                Replace all
              </button>
              <button onClick={() => setPendingImport(null)} className="btn-ghost text-xs">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import error banner */}
      {importError && (
        <div className="bg-red-900/40 border-t border-red-700/50 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <span className="text-red-300 text-sm">{importError}</span>
            <button onClick={() => setImportError(null)} className="text-red-400 hover:text-red-200">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

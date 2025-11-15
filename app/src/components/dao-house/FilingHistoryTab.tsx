'use client';

import { useEffect, useState } from 'react';

interface Filing {
  id: string;
  companyId: string;
  executionId: string;
  name: string;
  type: 'profit-loss' | 'payroll' | 'resolution' | 'shareholder-update';
  filedDate: string;
  description: string;
  status: 'pending' | 'processed' | 'approved' | 'executed';
  formats: {
    pdf?: string;
    json?: string;
    text?: string;
    markdown?: string;
  };
}

interface FilingHistoryTabProps {
  companyId: string;
  executionId: string;
}

const DOCUMENT_TYPES = [
  { value: 'profit-loss', label: 'Profit & Loss Statement', description: 'Triggers profit distribution to shareholders' },
  { value: 'shareholder-update', label: 'Share Reallocation Notice', description: 'Updates shareholder ownership percentages' },
];

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  processed: 'bg-blue-100 text-blue-800 border-blue-300',
  approved: 'bg-green-100 text-green-800 border-green-300',
  executed: 'bg-purple-100 text-purple-800 border-purple-300',
};

export function FilingHistoryTab({ companyId, executionId }: FilingHistoryTabProps) {
  const [filings, setFilings] = useState<Filing[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>('profit-loss');
  const [error, setError] = useState<string | null>(null);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [executionEvents, setExecutionEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  useEffect(() => {
    loadFilings();
  }, [companyId]);

  const loadFilings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/dao-house/filings?companyId=${companyId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch filings');
      }

      const { data } = await response.json();
      setFilings(data || []);
    } catch (err) {
      console.error('Error loading filings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load filings');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file to upload');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('companyId', companyId);
      formData.append('executionId', executionId);
      formData.append('documentType', documentType);

      const response = await fetch('/api/dao-house/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload document');
      }

      const result = await response.json();

      if (result.success) {
        // Reset form
        setSelectedFile(null);
        setDocumentType('profit-loss');

        // Reload filings
        await loadFilings();

        alert('Document uploaded successfully! Processing will begin automatically.');
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Error uploading document:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload document');
      alert(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  };

  const loadExecutionEvents = async () => {
    try {
      setLoadingEvents(true);
      const response = await fetch(`/api/executions/${executionId}/events`);
      if (response.ok) {
        const data = await response.json();
        setExecutionEvents(data.events || []);
      }
    } catch (err) {
      console.error('Error loading execution events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleDeleteEvent = async (eventId: string, documentId?: string) => {
    if (!confirm('Are you sure you want to delete this event? This will also delete the associated document.')) {
      return;
    }

    try {
      // Delete the event
      const response = await fetch(`/api/executions/${executionId}/events/${eventId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete event');
      }

      // If there's a document ID, delete the document too
      if (documentId) {
        await fetch(`/api/dao-house/documents/${documentId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, executionId }),
        });
      }

      // Reload events and filings
      await loadExecutionEvents();
      await loadFilings();

      alert('Event and document deleted successfully');
    } catch (err) {
      console.error('Error deleting event:', err);
      alert(`Failed to delete event: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteFiling = async (filing: Filing) => {
    if (!confirm(`Are you sure you want to delete "${DOCUMENT_TYPES.find((t) => t.value === filing.type)?.label || filing.type}"?`)) {
      return;
    }

    try {
      // Delete the document
      const response = await fetch(`/api/dao-house/documents/${filing.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, executionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      // Reload filings
      await loadFilings();

      alert('Document deleted successfully');
    } catch (err) {
      console.error('Error deleting document:', err);
      alert(`Failed to delete document: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading filing history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filing History - Companies House Style */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-2xl font-bold text-gray-900">Filing history</h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                loadExecutionEvents();
                setShowEventsModal(true);
              }}
              className="px-4 py-2 text-sm bg-[#1d70b8] hover:bg-[#1d4d7d] text-white font-bold"
            >
              View Execution Events
            </button>
            <button
              onClick={loadFilings}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-300 font-bold"
            >
              Refresh
            </button>
          </div>
        </div>

        {filings.length === 0 ? (
          <div className="text-center py-12 bg-gray-50">
            <p className="text-gray-600">No filing history available</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-300">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="px-4 py-3 text-left font-bold text-sm">Date</th>
                  <th className="px-4 py-3 text-left font-bold text-sm">Description</th>
                  <th className="px-4 py-3 text-right font-bold text-sm">View / Download</th>
                </tr>
              </thead>
              <tbody>
                {filings.map((filing, index) => (
                  <tr
                    key={filing.id}
                    className={`border-b border-gray-200 ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-4 text-sm">
                      {new Date(filing.filedDate).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-bold text-sm">
                          {DOCUMENT_TYPES.find((t) => t.value === filing.type)?.label || filing.type}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Status:{' '}
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded ${
                              STATUS_COLORS[filing.status]
                            }`}
                          >
                            {filing.status.charAt(0).toUpperCase() + filing.status.slice(1)}
                          </span>
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end gap-1">
                        {filing.formats.pdf && (
                          <a
                            href={`/api/dao-house/documents/${filing.id}/download?format=pdf`}
                            className="text-blue-600 hover:underline text-sm"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View PDF
                          </a>
                        )}
                        {filing.formats.json && (
                          <a
                            href={`/api/dao-house/documents/${filing.id}/download?format=json`}
                            className="text-blue-600 hover:underline text-xs"
                            download
                          >
                            Download JSON
                          </a>
                        )}
                        {filing.formats.markdown && (
                          <a
                            href={`/api/dao-house/documents/${filing.id}/download?format=markdown`}
                            className="text-blue-600 hover:underline text-xs"
                            download
                          >
                            Download MD
                          </a>
                        )}
                        <button
                          onClick={() => handleDeleteFiling(filing)}
                          className="text-red-600 hover:text-red-800 text-xs font-semibold mt-1"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Upload Section */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Upload New Document</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-900 bg-white text-gray-900 font-medium rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={uploading}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type.value} value={type.value} className="bg-white text-gray-900">
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Document (PDF)
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={uploading}
            />
            {selectedFile && (
              <p className="text-sm text-gray-600 mt-2">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          <button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full px-6 py-3 bg-[#00703c] hover:bg-[#005a30] text-white font-bold rounded disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
          <p className="text-sm text-blue-700">
            Documents will be automatically processed by Docling service and converted to multiple formats.
            Approved filings will trigger treasury actions based on the content.
          </p>
        </div>
      </div>

      {/* Execution Events Modal */}
      {showEventsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="bg-[#1d70b8] text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Execution Events</h2>
              <button
                onClick={() => setShowEventsModal(false)}
                className="text-white hover:text-gray-200 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {loadingEvents ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading events...</p>
                </div>
              ) : executionEvents.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded">
                  <p className="text-gray-600">No events found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {executionEvents.map((event: any, index: number) => (
                    <div
                      key={event.id || index}
                      className="bg-white border border-gray-300 rounded-lg p-4"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-bold text-gray-900">{event.type || 'Unknown Event'}</h4>
                          <p className="text-xs text-gray-500">
                            {event.timestamp
                              ? new Date(event.timestamp).toLocaleString('en-GB')
                              : 'No timestamp'}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleDeleteEvent(
                              event.id,
                              event.data?.documentId || event.eventData?.documentId
                            )
                          }
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="bg-gray-50 rounded p-3 mt-2">
                        <p className="text-xs text-gray-600 mb-1 font-semibold">Event Data:</p>
                        <pre className="text-xs text-gray-800 overflow-x-auto">
                          {JSON.stringify(event.data || event.eventData || {}, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
              <button
                onClick={() => setShowEventsModal(false)}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-bold rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

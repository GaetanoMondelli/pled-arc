/**
 * Simple HTML viewer for executions
 * Displays execution details and events with auto-refresh
 */

import { NextRequest, NextResponse } from 'next/server';
import { pledStorageService } from '@/lib/services/pled-storage-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params;

    // Get execution data
    const execution = await pledStorageService.getExecution(executionId);

    if (!execution) {
      return new NextResponse(
        `<html><body><h1>Execution not found</h1><p>Execution ${executionId} does not exist.</p></body></html>`,
        {
          headers: { 'Content-Type': 'text/html' },
          status: 404
        }
      );
    }

    const events = execution.externalEvents || execution.events || [];
    const eventTypes = [...new Set(events.map((e: any) => e.type))];

    // Generate HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Execution Viewer - ${execution.name}</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-bottom: 4px solid rgba(255,255,255,0.2);
    }

    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }

    .header p {
      opacity: 0.9;
      font-size: 14px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .stat {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
    }

    .controls {
      padding: 20px 30px;
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      gap: 15px;
      align-items: center;
      flex-wrap: wrap;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #667eea;
      color: white;
    }

    .btn-primary:hover {
      background: #5568d3;
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: #e0e0e0;
      color: #333;
    }

    .btn-secondary:hover {
      background: #d0d0d0;
    }

    .auto-refresh {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
    }

    .auto-refresh input {
      width: 18px;
      height: 18px;
      cursor: pointer;
    }

    .auto-refresh label {
      font-size: 14px;
      color: #666;
      cursor: pointer;
    }

    .events-section {
      padding: 30px;
    }

    .events-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .events-header h2 {
      font-size: 20px;
      color: #333;
    }

    .filter {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .filter select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }

    .events-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .event-card {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 16px;
      border-radius: 6px;
      transition: all 0.2s;
    }

    .event-card:hover {
      background: #e8eaf6;
      transform: translateX(4px);
    }

    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .event-type {
      font-weight: 600;
      color: #667eea;
      font-size: 14px;
    }

    .event-time {
      font-size: 12px;
      color: #999;
    }

    .event-data {
      background: white;
      padding: 12px;
      border-radius: 4px;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      overflow-x: auto;
      color: #333;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #999;
    }

    .empty-state svg {
      width: 64px;
      height: 64px;
      margin-bottom: 20px;
      opacity: 0.3;
    }

    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .badge-info {
      background: #e3f2fd;
      color: #1976d2;
    }

    .last-updated {
      text-align: center;
      padding: 20px;
      color: #999;
      font-size: 12px;
      border-top: 1px solid #e0e0e0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 ${execution.name || 'Execution Viewer'}</h1>
      <p>Execution ID: <strong>${executionId}</strong></p>
      ${execution.description ? `<p style="margin-top: 8px;">${execution.description}</p>` : ''}
    </div>

    <div class="stats">
      <div class="stat">
        <div class="stat-label">Total Events</div>
        <div class="stat-value" id="total-events">${events.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Event Types</div>
        <div class="stat-value">${eventTypes.length}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Template ID</div>
        <div class="stat-value" style="font-size: 16px;">${execution.templateId}</div>
      </div>
      <div class="stat">
        <div class="stat-label">Created</div>
        <div class="stat-value" style="font-size: 16px;">${new Date(execution.createdAt).toLocaleString()}</div>
      </div>
    </div>

    <div class="controls">
      <button class="btn btn-primary" onclick="refreshNow()">🔄 Refresh Now</button>
      <button class="btn btn-secondary" onclick="copyUrl()">🔗 Copy URL</button>
      <button class="btn btn-secondary" onclick="copyExecutionId()">📋 Copy Execution ID</button>

      <div class="auto-refresh">
        <input type="checkbox" id="auto-refresh-checkbox" checked onchange="toggleAutoRefresh()">
        <label for="auto-refresh-checkbox">Auto-refresh every 3 seconds</label>
      </div>
    </div>

    <div class="events-section">
      <div class="events-header">
        <h2>External Events (${events.length})</h2>
        <div class="filter">
          <label for="type-filter">Filter by type:</label>
          <select id="type-filter" onchange="filterEvents()">
            <option value="">All Types</option>
            ${eventTypes.map(type => `<option value="${type}">${type}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="events-list" id="events-list">
        ${events.length === 0 ? `
          <div class="empty-state">
            <div>📭</div>
            <h3>No events yet</h3>
            <p>Events will appear here as they are added to the execution.</p>
          </div>
        ` : events.slice().reverse().map((event, idx) => `
          <div class="event-card" data-type="${event.type}">
            <div class="event-header">
              <div>
                <span class="event-type">${event.type}</span>
                <span class="badge badge-info">${event.source || 'unknown'}</span>
              </div>
              <span class="event-time">${new Date(event.timestamp).toLocaleString()}</span>
            </div>
            <div class="event-data">${JSON.stringify(event.data, null, 2)}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="last-updated">
      Last updated: <span id="last-updated">${new Date().toLocaleString()}</span>
    </div>
  </div>

  <script>
    let autoRefreshInterval = null;

    function refreshNow() {
      window.location.reload();
    }

    function toggleAutoRefresh() {
      const checkbox = document.getElementById('auto-refresh-checkbox');

      if (checkbox.checked) {
        autoRefreshInterval = setInterval(() => {
          window.location.reload();
        }, 3000);
      } else {
        if (autoRefreshInterval) {
          clearInterval(autoRefreshInterval);
          autoRefreshInterval = null;
        }
      }
    }

    function copyUrl() {
      const url = window.location.href;
      navigator.clipboard.writeText(url).then(() => {
        alert('URL copied to clipboard!');
      });
    }

    function copyExecutionId() {
      const executionId = '${executionId}';
      navigator.clipboard.writeText(executionId).then(() => {
        alert('Execution ID copied to clipboard!');
      });
    }

    function filterEvents() {
      const filter = document.getElementById('type-filter').value;
      const events = document.querySelectorAll('.event-card');

      events.forEach(event => {
        if (!filter || event.dataset.type === filter) {
          event.style.display = 'block';
        } else {
          event.style.display = 'none';
        }
      });
    }

    // Start auto-refresh on page load
    toggleAutoRefresh();
  </script>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html' }
    });

  } catch (error: any) {
    console.error(`Error viewing execution:`, error);
    return new NextResponse(
      `<html><body><h1>Error</h1><p>${error.message}</p></body></html>`,
      {
        headers: { 'Content-Type': 'text/html' },
        status: 500
      }
    );
  }
}

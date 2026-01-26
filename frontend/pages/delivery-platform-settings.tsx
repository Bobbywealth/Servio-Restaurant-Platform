import React, { useState, useEffect } from 'react';

export default function DeliveryPlatformSettings() {
  const [credentials, setCredentials] = useState({
    platform: 'doordash',
    username: '',
    password: ''
  });
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Fetch existing sessions
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/delivery-platforms-sessions/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSessions(data.data);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const handleInitSession = async () => {
    setLoading(true);
    setMessage('Opening browser... Please login manually when the window appears.');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/delivery-platforms-sessions/init', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (data.success) {
        setMessage('✅ Session initialized successfully! You can now sync your menu.');
        fetchSessions(); // Refresh sessions list
      } else {
        setMessage('❌ ' + data.message);
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (platform, syncType) => {
    setLoading(true);
    setMessage(`Syncing ${syncType} to ${platform}...`);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/delivery-platforms/sync/${platform}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ syncType })
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✅ Synced ${data.data.itemsSynced} items successfully!`);
      } else {
        setMessage('❌ ' + data.data.errors.join(', '));
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Delivery Platform Automation</h1>

      {/* Step 1: Initialize Session */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Step 1: Initialize Session (First Time)</h2>
        <p className="text-gray-600 mb-4">
          A browser window will open. Login to your delivery platform account manually.
          The session will be saved and reused for future syncs.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Platform</label>
            <select
              value={credentials.platform}
              onChange={(e) => setCredentials({...credentials, platform: e.target.value})}
              className="w-full border rounded px-3 py-2"
            >
              <option value="doordash">DoorDash</option>
              <option value="ubereats">Uber Eats</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Email/Username</label>
            <input
              type="email"
              value={credentials.username}
              onChange={(e) => setCredentials({...credentials, username: e.target.value})}
              className="w-full border rounded px-3 py-2"
              placeholder="your-email@restaurant.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              value={credentials.password}
              onChange={(e) => setCredentials({...credentials, password: e.target.value})}
              className="w-full border rounded px-3 py-2"
              placeholder="Your password"
            />
          </div>

          <button
            onClick={handleInitSession}
            disabled={loading || !credentials.username || !credentials.password}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Opening Browser...' : 'Initialize Session'}
          </button>
        </div>
      </div>

      {/* Step 2: Active Sessions */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Step 2: Active Sessions</h2>

        {sessions.length === 0 ? (
          <p className="text-gray-500">No active sessions. Initialize a session above.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div key={session.platform} className="border rounded p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold capitalize">{session.platform}</h3>
                  <p className="text-sm text-gray-600">
                    Created: {new Date(session.createdAt).toLocaleDateString()}
                    {' • '}
                    Age: {session.ageInDays} days
                    {' • '}
                    {session.isValid ? (
                      <span className="text-green-600">✅ Valid</span>
                    ) : (
                      <span className="text-red-600">❌ Expired</span>
                    )}
                  </p>
                </div>

                {session.isValid && (
                  <div className="space-x-2">
                    <button
                      onClick={() => handleSync(session.platform, 'stock_update')}
                      disabled={loading}
                      className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
                    >
                      Sync Stock
                    </button>
                    <button
                      onClick={() => handleSync(session.platform, 'price_update')}
                      disabled={loading}
                      className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700"
                    >
                      Sync Prices
                    </button>
                    <button
                      onClick={() => handleSync(session.platform, 'full_sync')}
                      disabled={loading}
                      className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                    >
                      Full Sync
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status Message */}
      {message && (
        <div className={`rounded-lg p-4 ${
          message.includes('✅') ? 'bg-green-50 text-green-800' :
          message.includes('❌') ? 'bg-red-50 text-red-800' :
          'bg-blue-50 text-blue-800'
        }`}>
          {message}
        </div>
      )}

      {/* Quick Guide */}
      <div className="bg-gray-50 rounded-lg p-6 mt-6">
        <h3 className="font-semibold mb-3">📖 Quick Guide</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
          <li>Enter your DoorDash or Uber Eats credentials above</li>
          <li>Click "Initialize Session" - a browser window will open</li>
          <li>Login manually in the browser window (solve any captchas)</li>
          <li>Wait for "Session initialized successfully" message</li>
          <li>Your session is saved! Now you can use the sync buttons</li>
          <li>Sync buttons will update your menu on the platform automatically</li>
          <li>Session lasts 30 days, then you'll need to re-initialize</li>
        </ol>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';

// Placeholder until the real app shell is built: verifies the /api proxy works
export default function App() {
  const [status, setStatus] = useState('checking…');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((body: { status: string }) => setStatus(body.status))
      .catch(() => setStatus('unreachable'));
  }, []);

  return <p>API: {status}</p>;
}

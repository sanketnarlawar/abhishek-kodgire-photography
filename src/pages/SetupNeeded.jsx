import { CameraIcon } from '../components/icons'

export default function SetupNeeded() {
  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center gap-2">
        <span className="text-brand-600"><CameraIcon width={32} height={32} /></span>
        <h1 className="text-2xl font-bold">Studio Manager — Setup</h1>
      </div>
      <div className="card space-y-4">
        <p className="text-gray-600 dark:text-gray-300">
          The app is not connected to Supabase yet. Follow these one-time steps:
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-300">
          <li>Create a free account at <strong>supabase.com</strong> and make a new project.</li>
          <li>Open <strong>Project Settings → API</strong> and copy the <em>Project URL</em> and <em>anon public key</em>.</li>
          <li>In the project folder, copy <code>.env.example</code> to <code>.env</code> and paste both values.</li>
          <li>Open the <strong>SQL Editor</strong> in Supabase and run the script in <code>supabase/schema.sql</code>.</li>
          <li>Stop and restart the dev server (<code>npm run dev</code>).</li>
        </ol>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Full details are in <code>README.md</code> and <code>supabase/SETUP.md</code>.
        </p>
      </div>
    </div>
  )
}

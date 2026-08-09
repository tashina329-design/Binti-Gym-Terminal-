import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, QrCode, Globe, ShieldAlert, CheckCircle2 } from 'lucide-react';

export const QrPosterTab: React.FC = () => {
  const getDefaultUrl = () => {
    if (typeof window === 'undefined') return '';
    let origin = window.location.origin;
    // Replace dev domain with shared preview domain if present
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    return `${origin}${window.location.pathname}`;
  };

  const [appUrl, setAppUrl] = useState(getDefaultUrl);

  const isDevUrl = typeof window !== 'undefined' && window.location.origin.includes('ais-dev-');

  const cleanBase = appUrl.trim().replace(/\/$/, '');
  const checkInUrl = cleanBase
    ? cleanBase.includes('#')
      ? cleanBase
      : `${cleanBase}#checkin`
    : '';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <QrCode className="w-5 h-5 text-emerald-400" /> Print Entrance Wall QR Poster
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Generate an official print-ready QR code poster for your gym entrance wall. Members scan with any phone camera to self check-in.
        </p>
      </div>

      {/* Guidance Notice regarding Dev Proxy vs Public Access */}
      <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/30 text-amber-200 text-xs leading-relaxed space-y-2">
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <h4 className="font-bold text-sm text-white">
              Why Phone Scanning Gives "Access Denied" in Development Preview
            </h4>
            <p className="text-slate-300">
              The internal AI Studio sandbox preview URL (<code className="bg-slate-900 px-1 py-0.5 rounded text-amber-300 font-mono">ais-dev-...</code>) requires your developer Google account session to access. When a smartphone scans this link, Google blocks access because the phone is not logged into your AI Studio sandbox workspace.
            </p>
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-slate-200 space-y-1 mt-2">
              <p className="font-bold text-emerald-400">✅ How to make QR scanning work publicly:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
                <li><strong>Deploy / Export App:</strong> When you deploy the app to Cloud Run or export it to your own custom domain, external smartphones can scan without any login prompt.</li>
                <li><strong>Gym Entrance Tablet (Recommended):</strong> Mount an iPad/Tablet at reception with the check-in screen open so members type their phone number directly.</li>
              </ul>
            </div>
            <div className="pt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.open(checkInUrl || `${window.location.origin}#checkin`, '_blank')}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Globe className="w-3.5 h-3.5" /> Test Entrance Terminal in New Tab
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg">
        <label className="block text-xs font-semibold text-slate-400 mb-1">
          Your Gym Terminal / Web App Base URL
        </label>
        <input
          type="text"
          value={appUrl}
          onChange={(e) => setAppUrl(e.target.value)}
          placeholder="https://your-app-url.com"
          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
        />
      </div>

      {/* Printable Poster Container */}
      <div className="printable-poster max-w-sm mx-auto bg-slate-950 border-2 border-dashed border-emerald-500 p-8 rounded-2xl text-center shadow-2xl space-y-4">
        <div className="inline-block p-3 rounded-full bg-emerald-500/10 text-emerald-400 mb-1">
          <QrCode className="w-8 h-8" />
        </div>

        <h2 className="text-2xl font-black text-white tracking-wide uppercase">
          📱 SCAN TO CHECK-IN
        </h2>
        <p className="text-xs text-slate-400 font-medium">
          Point phone camera at code to log gym entry instantly
        </p>

        <div className="bg-white p-4 rounded-xl inline-block shadow-lg mx-auto my-4 border-4 border-white">
          {checkInUrl ? (
            <QRCodeSVG value={checkInUrl} size={220} level="H" includeMargin={false} />
          ) : (
            <div className="w-[220px] h-[220px] flex items-center justify-center text-slate-400 text-xs text-center p-4">
              Enter valid URL above
            </div>
          )}
        </div>

        <p className="text-xs text-emerald-400 font-mono font-bold break-all px-2">
          {checkInUrl || 'https://.../?p=checkin'}
        </p>

        <button
          onClick={handlePrint}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm shadow-md print:hidden"
        >
          <Printer className="w-4 h-4" /> 🖨️ Print Poster
        </button>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-poster, .printable-poster * {
            visibility: visible;
          }
          .printable-poster {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            width: 100%;
            max-width: 450px;
            border: 4px solid #10b981 !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .printable-poster h2 {
            color: #000000 !important;
          }
          .printable-poster p {
            color: #334155 !important;
          }
        }
      `}</style>
    </div>
  );
};

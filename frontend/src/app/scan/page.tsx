'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';

type DetectableBarcode = {
  rawValue?: string;
};

type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<DetectableBarcode[]>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function resolveScannedHref(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `/qr/${encodeURIComponent(trimmed)}`;
}

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [manualValue, setManualValue] = useState('');
  const [status, setStatus] = useState('Requesting camera access...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function startScanner() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot access the camera. Paste the QR URL manually below.');
        return;
      }

      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      if (!Detector) {
        setError('This browser does not support live QR detection. Paste the QR URL manually below.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setStatus('Point the camera at the product QR code.');
        const detector = new Detector({ formats: ['qr_code'] });

        const detectFrame = async () => {
          if (!active || !videoRef.current) return;

          try {
            const barcodes = await detector.detect(videoRef.current);
            const match = barcodes.find((barcode) => barcode.rawValue?.trim());
            if (match?.rawValue) {
              navigateToResult(match.rawValue);
              return;
            }
          } catch {
            setStatus('Camera is active. Try holding the QR code closer to the lens.');
          }

          frameRef.current = window.requestAnimationFrame(detectFrame);
        };

        frameRef.current = window.requestAnimationFrame(detectFrame);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to start the camera scanner.');
      }
    }

    function navigateToResult(rawValue: string) {
      const nextHref = resolveScannedHref(rawValue);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (/^https?:\/\//i.test(nextHref)) {
        window.location.href = nextHref;
        return;
      }
      router.push(nextHref);
    }

    void startScanner();

    return () => {
      active = false;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [router]);

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h3">Scan Product QR</Typography>
        <Typography variant="body2" color="text.secondary">
          Open the tablet camera, scan the QR URL on the product, and the system will route you to the intake page for identification and storage assignment.
        </Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            style={{ width: '100%', minHeight: 280, borderRadius: 12, backgroundColor: '#111827', objectFit: 'cover' }}
          />
          <Typography variant="body2">{status}</Typography>
        </Stack>
      </Paper>

      {error ? (
        <EmptyState title="Scanner fallback" description={error} />
      ) : null}

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Typography variant="subtitle1">Manual fallback</Typography>
          <Input
            label="QR URL or token"
            value={manualValue}
            onChange={(e: any) => setManualValue(e.target.value)}
            placeholder="http://localhost:3000/qr/CARG-002-SPACER-A"
          />
          <Button onClick={() => {
            if (!manualValue.trim()) return;
            const nextHref = resolveScannedHref(manualValue);
            if (/^https?:\/\//i.test(nextHref)) {
              window.location.href = nextHref;
              return;
            }
            router.push(nextHref);
          }}>
            Open scanned QR
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}

'use client';

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface QRCodeGeneratorProps {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  includeDownload?: boolean;
  fileName?: string;
}

export function QRCodeGenerator({
  value,
  size = 256,
  level = 'H',
  includeDownload = true,
  fileName = 'qrcode-rumi.png',
}: QRCodeGeneratorProps) {
  const qrRef = React.useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (qrRef.current) {
      const svg = qrRef.current.querySelector('svg');
      if (svg) {
        // Convert SVG to canvas for download
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const svgData = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        
        canvas.width = size;
        canvas.height = size;
        
        img.onload = () => {
          ctx?.drawImage(img, 0, 0);
          const pngUrl = canvas.toDataURL('image/png');
          const downloadLink = document.createElement('a');
          downloadLink.href = pngUrl;
          downloadLink.download = fileName;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        };
        
        img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
      }
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg">
          QR Code for {value.substring(0, 20)}
          {value.length > 20 ? '...' : ''}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <div
          ref={qrRef}
          className="p-4 border border-border/50 rounded-lg bg-white mb-4 shadow-inner"
        >
          <QRCodeSVG
            value={value}
            size={size}
            level={level}
            bgColor="#ffffff"
            fgColor="#2EB875"
          />
        </div>
        {includeDownload && (
          <Button
            onClick={handleDownload}
            variant="outline"
            className="w-full sm:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            Download QR Code
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

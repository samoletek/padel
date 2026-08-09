import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** Renders a QR code as inline SVG so it prints crisply at any size. */
export default function QrCode({ value, size = 200 }) {
    const path = useMemo(() => {
        const qr = qrcode(0, 'M');
        qr.addData(value);
        qr.make();

        const count = qr.getModuleCount();
        const parts = [];

        for (let row = 0; row < count; row++) {
            for (let col = 0; col < count; col++) {
                if (qr.isDark(row, col)) parts.push(`M${col} ${row}h1v1h-1z`);
            }
        }

        return { d: parts.join(''), count };
    }, [value]);

    return (
        <svg
            className="qr-code"
            width={size}
            height={size}
            viewBox={`-1 -1 ${path.count + 2} ${path.count + 2}`}
            role="img"
            aria-label={value}
        >
            <rect
                x={-1}
                y={-1}
                width={path.count + 2}
                height={path.count + 2}
                fill="#f0f0f5"
                rx={1}
            />
            <path d={path.d} fill="#0a0a0f" />
        </svg>
    );
}

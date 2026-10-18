// Framer code component: autoplaying demo video, "Try it now" on hover, opens the live demo.
// In Framer: Assets → Code → + → New Component, paste this file, then drag "OfferRowDemo" onto the canvas.
import { addPropertyControls, ControlType } from "framer"
import { useState } from "react"

type Props = {
    video: string
    link: string
    label: string
    background: string
    radius: number
}

export default function OfferRowDemo({ video, link, label, background, radius }: Props) {
    const [hover, setHover] = useState(false)

    return (
        <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onFocus={() => setHover(true)}
            onBlur={() => setHover(false)}
            aria-label={`${label}: open the live offer row demo`}
            style={{
                position: "relative",
                display: "block",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                borderRadius: radius,
                background,
                cursor: "pointer",
            }}
        >
            {video ? (
                <video
                    src={video}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        display: "block",
                        transform: hover ? "scale(1.015)" : "scale(1)",
                        transition: "transform 400ms cubic-bezier(0.2, 0, 0, 1)",
                    }}
                />
            ) : (
                <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#888", font: "14px Inter, sans-serif" }}>
                    Pick the demo video in the right panel
                </div>
            )}

            {/* soft veil + button, only on hover */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(255,255,255,0.35)",
                    opacity: hover ? 1 : 0,
                    transition: "opacity 200ms ease",
                    pointerEvents: "none",
                }}
            />
            <span
                style={{
                    position: "absolute",
                    left: "50%",
                    bottom: 28,
                    transform: `translate(-50%, ${hover ? 0 : 8}px)`,
                    opacity: hover ? 1 : 0,
                    transition: "opacity 200ms ease, transform 260ms cubic-bezier(0.2, 0, 0, 1)",
                    padding: "10px 18px",
                    borderRadius: 999,
                    background: "#111",
                    color: "#fff",
                    font: "500 14px/1 Inter, -apple-system, sans-serif",
                    letterSpacing: 0.1,
                    whiteSpace: "nowrap",
                    boxShadow: "0 8px 24px -10px rgba(0,0,0,0.35)",
                    pointerEvents: "none",
                }}
            >
                {label} ↗
            </span>
        </a>
    )
}

OfferRowDemo.defaultProps = {
    link: "https://shuyii0315-arch.github.io/offer-row/",
    label: "Try it now",
    background: "#F5F5F3",
    radius: 0,
}

addPropertyControls(OfferRowDemo, {
    video: { type: ControlType.File, title: "Video", allowedFileTypes: ["mp4", "webm", "mov"] },
    link: { type: ControlType.String, title: "Link" },
    label: { type: ControlType.String, title: "Label" },
    background: { type: ControlType.Color, title: "Background" },
    radius: { type: ControlType.Number, title: "Radius", min: 0, max: 48, step: 1 },
})

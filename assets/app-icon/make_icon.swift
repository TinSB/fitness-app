// Rede App 图标 · 方向 A 刻度轨（owner 拍板 2026-06-10）
// 锻铁深底 + 刻线 bevel + Emberline 单点缀；零依赖 CoreGraphics 绘制
import CoreGraphics
import ImageIO
import Foundation
import UniformTypeIdentifiers

let S = 1024
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: S, height: S, bitsPerComponent: 8, bytesPerRow: 0,
                    space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.translateBy(x: 0, y: CGFloat(S))
ctx.scaleBy(x: 1, y: -1)   // 顶左坐标系

func rgba(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255, alpha: a)
}

// 1. 锻面垂直渐变 + vignette
let grad = CGGradient(colorsSpace: cs, colors: [rgba(0x1A1712), rgba(0x12100D)] as CFArray, locations: [0, 1])!
ctx.drawLinearGradient(grad, start: .zero, end: CGPoint(x: 0, y: S), options: [])
let vig = CGGradient(colorsSpace: cs,
                     colors: [rgba(0x000000, 0), rgba(0x0B0906, 0.55)] as CFArray, locations: [0.55, 1])!
ctx.drawRadialGradient(vig, startCenter: CGPoint(x: 512, y: 512), startRadius: 0,
                       endCenter: CGPoint(x: 512, y: 512), endRadius: 760, options: [])

func roundedRect(_ r: CGRect, _ radius: CGFloat, _ color: CGColor) {
    ctx.setFillColor(color)
    ctx.addPath(CGPath(roundedRect: r, cornerWidth: radius, cornerHeight: radius, transform: nil))
    ctx.fillPath()
}
func caret(_ cx: CGFloat, _ tipY: CGFloat, _ baseY: CGFloat, _ halfW: CGFloat, _ color: CGColor) {
    ctx.setFillColor(color)
    ctx.beginPath()
    ctx.move(to: CGPoint(x: cx, y: tipY))
    ctx.addLine(to: CGPoint(x: cx - halfW, y: baseY))
    ctx.addLine(to: CGPoint(x: cx + halfW, y: baseY))
    ctx.closePath()
    ctx.fillPath()
}

// 2. ember 辉光（分层低透明度伪高斯）
for i in stride(from: 25, through: 0, by: -1) {
    let t = CGFloat(i) / 25
    let grow = 6 + t * 64
    let a = 0.018 * pow(1 - t, 1.4) + 0.004
    let c = rgba(0xE1652B, a)
    roundedRect(CGRect(x: 496 - grow, y: 410 - grow, width: 32 + grow * 2, height: 205 + grow * 2), 16 + grow, c)
    caret(512, 307 + grow * 0.4, 230 - grow * 0.6, 45 + grow, c)
}

// 3. 轨道刻槽 + 下缘受光 bevel
roundedRect(CGRect(x: 154, y: 503, width: 716, height: 18), 9, rgba(0x2A261F))
roundedRect(CGRect(x: 154, y: 521, width: 716, height: 3), 1.5, rgba(0xECE6D8, 0.06))

// 4. 旁站刻度
for x: CGFloat in [205, 358, 666, 819] {
    roundedRect(CGRect(x: x - 9, y: 461, width: 18, height: 102), 9, rgba(0x5A544A))
    roundedRect(CGRect(x: x - 9, y: 563, width: 18, height: 3), 1.5, rgba(0xECE6D8, 0.07))
}

// 5. ember 主站 + 指针
roundedRect(CGRect(x: 496, y: 410, width: 32, height: 205), 16, rgba(0xE1652B))
caret(512, 307, 230, 45, rgba(0xE1652B))
// 主站顶部高光（受光面，金属漆质感）
roundedRect(CGRect(x: 500, y: 414, width: 24, height: 56), 12, rgba(0xF0875A, 0.55))

let img = ctx.makeImage()!
let url = URL(fileURLWithPath: "ios/Rede/Assets.xcassets/AppIcon.appiconset/AppIcon1024.png") as CFURL
let dest = CGImageDestinationCreateWithURL(url, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, img, nil)
CGImageDestinationFinalize(dest)
print("saved 1024x1024")

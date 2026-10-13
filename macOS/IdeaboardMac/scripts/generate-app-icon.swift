import AppKit
import CoreGraphics
import Foundation
import ImageIO

let outputDirectory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let sizes = [16, 32, 64, 128, 256, 512, 1024]

func color(_ hex: UInt32) -> CGColor {
    CGColor(
        red: CGFloat((hex >> 16) & 0xff) / 255,
        green: CGFloat((hex >> 8) & 0xff) / 255,
        blue: CGFloat(hex & 0xff) / 255,
        alpha: 1
    )
}

let ink = color(0x172038)
let yellow = color(0xFFDA45)
let paper = color(0xFFFEF8)
let purple = color(0x6957FF)
let coral = color(0xFF8E8E)
let mint = color(0x60DCBD)
let cyan = color(0x8FD7FF)

func roundedPath(_ rect: CGRect, radius: CGFloat) -> CGPath {
    CGPath(roundedRect: rect, cornerWidth: radius, cornerHeight: radius, transform: nil)
}

func drawNote(_ context: CGContext, rect: CGRect, angle: CGFloat, fill: CGColor, lineCount: Int) {
    context.saveGState()
    context.translateBy(x: rect.midX, y: rect.midY)
    context.rotate(by: angle)
    let local = CGRect(x: -rect.width / 2, y: -rect.height / 2, width: rect.width, height: rect.height)
    let path = roundedPath(local, radius: 30)
    context.setShadow(offset: CGSize(width: 4, height: -7), blur: 0, color: ink)
    context.addPath(path)
    context.setFillColor(fill)
    context.fillPath()
    context.setShadow(offset: .zero, blur: 0)
    context.addPath(path)
    context.setStrokeColor(ink)
    context.setLineWidth(18)
    context.strokePath()

    context.setStrokeColor(ink)
    context.setLineWidth(13)
    context.setLineCap(.round)
    for index in 0..<lineCount {
        let y = local.minY + 47 + CGFloat(index) * 37
        let path = CGMutablePath()
        path.move(to: CGPoint(x: local.minX + 35, y: y))
        path.addLine(to: CGPoint(x: local.minX + rect.width * (index == lineCount - 1 ? 0.56 : 0.84), y: y + CGFloat(index % 2 == 0 ? 2 : -2)))
        context.addPath(path)
        context.strokePath()
    }
    context.restoreGState()
}

func renderIcon(size: Int) -> CGImage {
    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
    let context = CGContext(
        data: nil,
        width: size,
        height: size,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    )!
    context.setAllowsAntialiasing(true)
    context.setShouldAntialias(true)
    context.scaleBy(x: CGFloat(size) / 1024, y: CGFloat(size) / 1024)

    context.setFillColor(yellow)
    context.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))

    let frame = CGRect(x: 80, y: 76, width: 864, height: 872)
    context.addPath(roundedPath(frame, radius: 210))
    context.setFillColor(ink)
    context.fillPath()

    let board = CGRect(x: 112, y: 112, width: 800, height: 800)
    context.addPath(roundedPath(board, radius: 174))
    context.setFillColor(paper)
    context.fillPath()

    let boardOutline = roundedPath(board.insetBy(dx: 8, dy: 8), radius: 166)
    context.addPath(boardOutline)
    context.setStrokeColor(ink)
    context.setLineWidth(22)
    context.strokePath()

    drawNote(context, rect: CGRect(x: 190, y: 632, width: 320, height: 178), angle: -0.075, fill: coral, lineCount: 2)
    drawNote(context, rect: CGRect(x: 526, y: 548, width: 300, height: 180), angle: 0.055, fill: mint, lineCount: 2)
    drawNote(context, rect: CGRect(x: 224, y: 348, width: 314, height: 166), angle: 0.035, fill: cyan, lineCount: 2)

    let markerDot = CGRect(x: 650, y: 445, width: 86, height: 86)
    context.setFillColor(purple)
    context.fillEllipse(in: markerDot)
    context.addPath(roundedPath(CGRect(x: 662, y: 238, width: 62, height: 190), radius: 28))
    context.fillPath()

    return context.makeImage()!
}

try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
for size in sizes {
    let name = "ideaboard-\(size).png"
    let fileURL = outputDirectory.appendingPathComponent(name)
    let destination = CGImageDestinationCreateWithURL(fileURL as CFURL, "public.png" as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, renderIcon(size: size), nil)
    guard CGImageDestinationFinalize(destination) else {
        fatalError("Could not write \(fileURL.path)")
    }
}

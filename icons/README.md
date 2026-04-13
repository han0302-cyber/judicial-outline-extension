# Icons

Chrome Web Store 上架需要以下四個 PNG 尺寸：

| 檔名 | 尺寸 | 用途 |
|---|---|---|
| `icon16.png` | 16×16 | Extension toolbar、右鍵選單 |
| `icon32.png` | 32×32 | Windows 常用尺寸 |
| `icon48.png` | 48×48 | `chrome://extensions` 管理頁 |
| `icon128.png` | 128×128 | Chrome Web Store listing 主視覺 |

## 從 `icon.svg` 匯出 PNG 的方法

**方法 A：rsvg-convert（最快）**
```bash
brew install librsvg
cd icons
for size in 16 32 48 128; do
  rsvg-convert -w $size -h $size icon.svg -o icon${size}.png
done
```

**方法 B：ImageMagick**
```bash
brew install imagemagick
cd icons
for size in 16 32 48 128; do
  magick -background none -density 1024 icon.svg -resize ${size}x${size} icon${size}.png
done
```

**方法 C：線上工具**
上傳 `icon.svg` 到 [realfavicongenerator.net](https://realfavicongenerator.net/)
或 [cloudconvert.com/svg-to-png](https://cloudconvert.com/svg-to-png)，
每個尺寸各轉一次下載。

**方法 D：Figma / Sketch / Illustrator**
匯入 `icon.svg`，匯出 4 個尺寸 PNG。

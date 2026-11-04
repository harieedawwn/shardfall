# Shardfall — Kế hoạch lột xác hình ảnh ("Flat++")

Tài liệu này là style guide + kế hoạch kỹ thuật cho đợt nâng cấp trình bày. Gameplay không đổi (cổng hash `tools/hash-check.js`).

## 1. Style guide

### 1.1 Phong cách
"Flat++" = hoạt hình khối dày có ánh sáng. Giữ: viền mực `#14121F`, bóng hình rõ, mỗi loại quái một hình + màu riêng.
Thêm: tô bóng 2 tầng nướng sẵn (sáng phía trên-trái, tối phía dưới-phải), một vệt highlight, bóng tiếp đất là elip cứng
(không mờ), mắt/biểu cảm, ánh sáng cộng (`lighter`) cho đạn/nổ/nguyên tố/vật phẩm với số lượng giới hạn theo chất lượng.

Góc nhìn nhân vật: "top-down 3/4". Thân không xoay theo hướng ngắm (để mặt luôn đọc được), chỉ lật trái/phải;
mắt nhìn theo mục tiêu; vũ khí xoay theo hướng ngắm. Quái có hướng (khiên, nòng súng, lưỡi hái) vẫn xoay bộ phận đó.

### 1.2 Token màu (nguồn duy nhất)
- Canvas: `NR.fx.art.T` trong `src/fx/art.js`. UI DOM: biến CSS `--*` trong `:root` của `css/ui.css`. Hai bảng dùng chung giá trị.
- Mực/nền: `ink #14121F`, `ink2 #0B0A12`, `night #1A1428` (nền màn), `panel #251C38`, `panel2 #30254A`, `line #46386A`.
- Chữ: `cream #F6F0DF` (chữ chính, 15.6:1 trên `panel`), `mute #B8B0CC` (8.4:1), `dim #8F88A6` (chỉ chữ ≥ 18 px, 4.9:1).
- Nhấn chính (CTA): `amber #FFC23D` với chữ `ink` (11.9:1) — sửa lỗi chữ kem trên nền vàng. Nhấn phụ: `cyan #6FD6F2`.
- Trạng thái: `good #8BD450`, `bad #FF5468`, `hp #FF5C8A`, `xp #6FD6F2`, `ult #B57CFF`, `gold #FFC23D`.
- Độ hiếm: `common #B9B6C8`, `rare #4FA8F0`, `epic #B26CF5`, `legendary #FFC23D`.
- Nguyên tố (giữ §12 cũ): physical `#F2EFE6`, fire `#FF7A2F`, ice `#7FD3F0`, shock `#FFD43B`, poison `#8BD450`, void `#A25CE0`.
- Vùng: giữ bảng 6 màu §4 làm gốc; sàn dùng `ground/ground2` đã giảm bão hòa ~25% và kéo về phía `ink` khi nướng.
- Đạn địch: lõi `#FF3D6E`, viền trong trắng `#FFFFFF`, viền ngoài mực, quầng sáng hồng. Đây là màu "nóng" duy nhất
  được phép trên sàn; đạn người chơi không dùng hồng/đỏ.

### 1.3 Viền và hình
- Viền mực: 3 px thế giới cho thân (≥ 2 px màn hình ở mọi tỉ lệ), 2 px cho chi tiết nhỏ. `lineJoin = round`.
- Elite: viền nhấn vàng `#FFC23D` 2 px ngoài viền mực + hào quang ánh sáng (sprite `lighter`) nhịp chậm.
- Trùm: cỡ 3–5×, thanh máu lớn trên cùng, đoạn ra mắt (tên + vạch).
- Hình hiển thị: người chơi vẽ lớn hơn hitbox (×1.45, có tâm chấm hitbox khi dash/bị bắn), quái ×1.15 so với `r`.

### 1.4 Thứ tự ưu tiên thị giác (cao → thấp)
1. Đạn địch + vùng cảnh báo: hình riêng (gai 4 cánh/viên có viền trắng), tương phản cao nhất, có quầng sáng.
2. Người chơi: màu bão hòa, viền sáng mảnh, luôn vẽ trên quái.
3. Quái: bão hòa vừa, viền mực.
4. Vật phẩm rơi: nhỏ, có ánh sáng nhẹ, nhấp nháy khi sắp mất.
5. Đạn người chơi: bớt rực (giảm 30% độ sáng, không viền mực, alpha 0.9), quầng sáng nhỏ.
6. Hạt hiệu ứng: ngắn, gom lô theo màu.
7. Nền: trầm, ít bão hòa, tương phản thấp (độ chênh sáng giữa các ô ≤ 6%).

### 1.5 Quy tắc ánh sáng
- Gradient CHỈ dùng khi nướng sprite (offscreen canvas, lúc khởi tạo / đổi vùng / đổi tỉ lệ). Không gọi `create*Gradient`
  trên canvas chính và không gọi trong vòng lặp khung hình.
- Sprite ánh sáng (radial nướng sẵn) vẽ bằng `globalCompositeOperation = 'lighter'` trong một pass gom lô, có trần số lượng
  theo chất lượng: Thấp 0, Trung bình 90, Cao 260.
- Vẫn cấm: `shadowBlur`, `shadowColor`, `ctx.filter`, các composite khác (`screen`, `color-dodge`...), CSS `filter`,
  `backdrop-filter`, `blur()`, `mix-blend-mode`, box/text-shadow có bán kính mờ.
- `reduceFlashing`: không nháy toàn màn, không nháy trắng thân quái (thay bằng viền trắng), ánh sáng nổ giảm 60%.
- `prefers-reduced-motion`: tắt bob/nhún, rung, hạt trôi parallax, chuyển cảnh trượt (chỉ mờ dần).

### 1.6 Typography
- Tiêu đề: **Baloo 2 ExtraBold** (OFL) — tròn, dày, hợp viền mực. Nội dung: **Be Vietnam Pro** Medium/Bold (OFL) — thiết kế
  cho tiếng Việt, dấu chồng rõ. Nhúng woff2 base64 (subset Latin + tiếng Việt) trong `css/fonts.css`.
- `line-height` ≥ 1.3 cho nội dung, ≥ 1.15 cho tiêu đề Baloo (dấu "Ẫ/Ỗ" không bị cắt). Chữ tối thiểu 12 px CSS.

### 1.7 Bộ UI (DOM)
Panel (nền `panel`, viền mực 3 px, bóng cứng 6 px, dải highlight trên 2 px), nút (CTA amber/chữ mực; thường `panel2`;
focus = khung amber dày 3 px + nâng 2 px), thẻ có khung theo độ hiếm (dải màu trên + góc cắt), tooltip (chạm giữ 350 ms /
chạm để xem / focus gamepad), thanh máu/XP/ULT dạng viên thuốc có lõi sáng. Mỗi màn: chuyển cảnh mờ 160 ms + thành phần
xuất hiện lần lượt (stagger 40 ms).

## 2. Kỹ thuật

- **Khung nhìn**: canvas phủ `visualViewport`; chiều ngắn của thế giới nhìn thấy = 720 px; chiều dài theo tỉ lệ, tối đa
  21:9 (1680 px). Vượt 21:9 → vẽ viền trang trí hai bên. Backing = CSS × min(DPR, trần theo chất lượng) × renderScale.
  `NR.camera.resize(viewW, viewH)` theo đơn vị thế giới; render dùng `setTransform(k,…)`.
- **Dọc**: điện thoại/tablet cầm dọc khi đang đánh → tự `togglePause` + màn "xoay ngang" (lớp phủ DOM trong `screens.js`).
- **Cache sàn**: khối 512×512 px thế giới, nướng theo nhu cầu ở tỉ lệ `min(k·dpr, 2)` (≤ 1024 px/khối, < 2048 giới hạn iOS).
- **Sprite**: `NR.fx.art` nướng thân/mắt/đạn/ánh sáng theo (loại, màu, bậc kích thước, chất lượng); cache vô hiệu khi đổi tỉ lệ.
- **Chất lượng**: `settings.quality` = `auto|low|medium|high`. Thấp: DPR 1, không `lighter`, không hạt parallax, ít hạt.
  Tự động: chọn theo thiết bị (bộ nhớ, số lõi, cảm ứng) và hạ `renderScale` (1 → 0.85 → 0.7) khi khung hình vượt ngân sách.

## 3. File dự kiến sửa
- `index.html` (meta viewport, `css/fonts.css`, `src/fx/art.js`, manifest), `css/ui.css`, `css/fonts.css` (mới).
- `src/fx/art.js` (mới: token, nướng sprite, ánh sáng), `render.js`, `floor.js`, `particles.js`, `juice.js`, `shapes.js`.
- `src/ui/hud.js`, `screens.js`, `touch.js`, `src/lang/{vi,en}.js`.
- `src/core/save.js` (chỉ thêm default `quality`), `src/core/camera.js` (chỉ resize nhận kích thước thế giới — đã có).
- `tests/*` (viết lại test Acceptance 12 theo §12 mới, thêm test đối chiếu tooltip), `tests/harness.js`, `tests/fake-canvas.js`.
- `SPEC.md`, `README.md`, `CREDITS.md`, `tools/*`, `docs/*`.

## 4. Rủi ro
- Hash lệch do fx vô tình đọc/ghi trường sim → mọi trường fx ghi lên entity giữ nguyên danh sách cũ (`flash sx sy fvx fvy kox koy _tr`).
- Hiệu năng mức Thấp trên máy yếu: giữ đường vẽ "fast fallback" cũ khi `particles.quality() >= 3`.
- Safari iOS: giới hạn diện tích canvas, `visualViewport` thay đổi khi thanh công cụ ẩn/hiện → nghe `visualViewport.resize`.
- Trình duyệt trong app (Zalo/Messenger): `localStorage` có thể ném lỗi → save đã có fallback; fullscreen bị chặn → ẩn nút.
- Font qua `file://`: nhúng base64 nên không có request; canvas phải chờ `document.fonts.load` trước khi vẽ chữ HUD lần đầu.
- Test cũ khóa cứng danh sách file fx/ui và luật cấm cũ → cập nhật cùng SPEC §6/§12 (ghi trong báo cáo).

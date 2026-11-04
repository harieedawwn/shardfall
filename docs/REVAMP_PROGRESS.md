# Tiến độ lột xác hình ảnh

Nhánh: `revamp/visual`. Đọc file này trước khi làm tiếp.

## Đã xong
- [x] Giai đoạn 0: khảo sát, `tools/baseline-hashes.json` (48 hash), `tools/hash-check.js`, `tools/shots.js`, `tools/fps.js`,
      ảnh `docs/screenshots/before/`, `docs/REVAMP_PLAN.md`.

- [x] Giai đoạn 1: canvas phủ visualViewport + DPR (trần theo chất lượng), thế giới 720 px chiều ngắn tới 21:9 + viền trang trí,
      `render.toView` cho chuột, HUD canvas theo CSS px + vùng an toàn (`--sat/--sar/--sab/--sal`), cụm nút cảm ứng tròn,
      màn xoay ngang + tự tạm dừng, sàn chia khối 512 px thế giới (≤1024 px), cài đặt `quality`, chặn cử chỉ trình duyệt,
      ẩn fullscreen khi không hỗ trợ, ULT trên gamepad = Y, bỏ hệ số "x1.05" giả của combo (không có trong sim).
      Test Acceptance 12 viết lại (gradient chỉ trong `src/fx/art.js`, 'lighter' chỉ trong src/fx, không tạo gradient sau warm-up).

- [x] Giai đoạn 2 (lát cắt mẫu, chờ duyệt): `src/fx/actors.js` (ranger, grunt, swarmer, spitter có mắt/biểu cảm, nhún, bước,
      nháy trắng, đóng băng), sàn scrap mới theo ô, đạn địch hình gai viền trắng + quầng sáng, đạn súng lục bớt rực,
      telegraph sọc + viền hai lớp, pass ánh sáng 'lighter' có trần, bụi parallax + vignette nướng sẵn, HUD mới,
      bộ UI Flat++ (font nhúng, nút/panel/thẻ bo góc, chuyển cảnh + xuất hiện lần lượt), màn lên cấp mới.
      Ảnh: `docs/screenshots/slice/`.

## Đang làm
- Chờ duyệt lát cắt mẫu trước Giai đoạn 3 (2 vùng còn lại, 9 quái, 3 trùm, 3 nhân vật, mọi vũ khí/nguyên tố).
- Quyết định mới: thêm file `src/fx/actors.js` (sprite nhân vật/quái) ngoài `art.js`.
- Tồn đọng đã biết: `--strict-events` lỗi sẵn từ baseline; SPEC/README/CREDITS chưa cập nhật (làm ở Giai đoạn 6).

## Quyết định đã chốt
- Font: Baloo 2 ExtraBold (tiêu đề) + Be Vietnam Pro Medium/Bold (nội dung), OFL, subset Latin+Việt, base64 trong `css/fonts.css`.
- Thêm đúng một file fx mới `src/fx/art.js` (token + nướng sprite + ánh sáng), nạp ngay sau `shapes.js`.
- Thân nhân vật/quái không xoay theo hướng ngắm, chỉ lật trái/phải; vũ khí + mắt theo hướng ngắm.
- Vùng cấm cũ "opacity/rgba" trong CSS được bỏ (cần cho chuyển cảnh/lớp phủ), vẫn cấm blur/filter/backdrop/blend.
- Cổng xoay ngang áp dụng cho mọi thiết bị khi khung nhìn dọc (tỉ lệ < 1) trong lúc đánh.

## Ghi chú baseline
- `node tests/run.js`: 107/107. `--strict-events`: 106/107 ngay từ baseline (bot 70 s không chạm tới run:end, weapon:evolve,
  chain:arc, area:explode, player:hurt, player:death, boss:phase, boss:death) — lỗi có sẵn, không phải do đợt này.
- Stress (Chromium headless, 1280×720, DPR 1): ~46–51 FPS, render trung bình ~3.0 ms, p95 ~4.7 ms.

## Đợt yêu cầu thêm (chủ game duyệt thay đổi gameplay)
- 7 vũ khí mới (tiểu liên, nỏ độc, băng truy, đĩa sét, súng ray, búa sấm, trượng sao chổi); `dasher` mở sẵn cùng `ranger`.
- Cài đặt `autoAim` (tự ngắm, mọi thiết bị); director thêm tối đa +15% ngân sách quái khi người chơi máu ≥85% và ít quái gần.
- Baseline hash ghi lại sau thay đổi gameplay có chủ đích (`tools/baseline-hashes.json`).
- Nhân vật: mũ trùm che mặt tối (không mắt), trang phục 4 bậc theo sức mạnh; quái "dread" bậc 1/2 ở frost/void.
- Hiệu ứng: khói mềm, quả cầu lửa, tàn lửa phát sáng; âm thanh súng kiểu thực + vang phòng; hào quang icon theo độ hiếm.
- Đợt 3: bỏ mắt mọi sinh vật; mỗi ô vũ khí là một tay cầm súng riêng quanh nhân vật; 6 quái đặc biệt + turret
  (Kẻ Nghiền, Kẻ Bắt Cóc, Kẻ Tiếp Sức, Bóng Láu, Thợ Pháo, Pháo Thủ), 3–7 con/đợt theo đợt và độ khó;
  đạn địch 8 kiểu; boss có giáp + lõi lộ theo chu kỳ (điểm yếu) và lá chắn chống burst; đòn mới laser/nhảy đập/thiên thạch/mìn;
  2 boss ngẫu nhiên mới (Vua Rỗng, Mẹ Bầy), không lặp trong một ván. Baseline hash ghi lại.

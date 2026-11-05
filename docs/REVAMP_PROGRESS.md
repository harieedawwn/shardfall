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

## Đợt gameplay
Đợt này làm 7 bước gameplay liên tiếp, mỗi bước kiểm tra bằng `node tests/run.js` + cổng hash (`tools/hash-check.js`), rồi đẩy lên `main`.
Nhật ký chi tiết và các quyết định tự đưa ra nằm trong `notes/gameplay-log.md`; hợp đồng dữ liệu/sự kiện mới nằm trong `SPEC.md`.

- [x] Bước 1 — Công cụ cân bằng + sửa lỗi: `tools/balance.js` (chạy song song `--sim 1200` trên seed 1..20 × 4 nhân vật × độ khó 0/3, in tỉ lệ thắng,
      đợt trung bình, tỉ trọng sát thương từng vũ khí/vật phẩm, cảnh báo id >35%). `static_charm` không còn nhân theo số tay súng × tốc độ bắn
      (một tia mỗi lần hồi). Kiếm khách không thắng nổi trùm 1 là do **bot** luôn kite ngoài tầm kiếm (không phải giáp/lá chắn trùm): bot có chế độ cận chiến.
- [x] Bước 2 — Phản ứng nguyên tố (Vỡ băng, Nổ độc, Siêu dẫn, Nội phá, Hơi nước; bảng dữ liệu, hồi chiêu theo kẻ địch, sự kiện `status:react`)
      và hiệu ứng bộ 3+ vũ khí cùng nguyên tố (hiện trên HUD và thẻ cửa hàng).
- [x] Bước 3 — Mọi vũ khí đều có tiến hóa (23/23) với hành vi mới (vệt lửa, vòng băng 360°, tường laser, hố đen, cưa hai vòng hút máu, oanh tạc,
      mìn dây chuyền, mũi băng, vệt độc, hồn truy, nòng quay, nỏ nổ độc, băng truy đóng băng, vòng sấm, ray phản xạ, búa thiên lôi, mưa sao chổi),
      6 chất xúc tác mới, nhãn "tiến hóa" ở cửa hàng, bách khoa liệt kê mọi công thức (thành phẩm là bóng đen).
- [x] Bước 4 — Tinh anh có phẩm chất (Khiên, Phân thân, Vệt độc, Thần tốc, Hút máu, Nổ tung, Từ trường; 1 loại, 2 loại từ độ khó 3 hoặc đợt 11, luôn rơi rương)
      và 3 sự kiện giữa đợt (Kẻ mang vàng, Đền nguyền rủa, Mưa mảnh vỡ) với biểu ngữ, đồng hồ và mũi tên chỉ hướng trên HUD.
- [x] Bước 5 — 20 đặc tính ở thẻ lên cấp (mỗi lần lên cấp có ít nhất một thẻ ĐẶC TÍNH, có gợi ý hợp bản dựng) và màn chọn lộ trình sau cửa hàng
      (Bầy đàn, Săn tinh anh, Yên ả, Cơn sốt vàng, Điềm báo) hỗ trợ bàn phím, tay cầm, cảm ứng.
- [x] Bước 6 — 15 thành tựu + 4 thử thách nhân vật, 7 món đồ khóa cho tới khi đạt thành tựu, tab Thành tựu trong bách khoa, thông báo khi đạt,
      màn kết thúc liệt kê phần mở khóa; "Thử thách ngày" (hạt giống/nhân vật/độ khó theo ngày UTC, một lượt tính điểm mỗi ngày, lịch sử 30 ngày, sao chép kết quả).
- [x] Bước 7 — Rà soát cuối: chạy lại `tools/balance.js`, không id nào vượt 35% tổng sát thương, nội dung bị khóa không lọt vào cửa hàng/rương/thẻ (có test).

### Số liệu cân bằng cuối (bot, 160 ván × 1200 s)
Xem mục "Step 7" trong `notes/gameplay-log.md` (bảng trước/sau của cả 7 bước).

### Lưu ý cho người duyệt
- Mọi chuỗi hiển thị đều có đủ vi/en; dữ liệu có tên/mô tả `{vi,en}`; file mới đã nằm trong thứ tự script của `index.html`.
- Save cũ (`tools/fixtures/pre-revamp-save.json`) vẫn mở được; các khóa mới (`meta.ach`, `meta.progress`, `meta.daily`, `player.traits`, `daily`) có giá trị mặc định an toàn.
- Baseline hash đã ghi lại sau mỗi bước vì hành vi bot/gameplay thay đổi có chủ đích.
- Bot không chủ động đi tìm sự kiện giữa đợt; chỉ né các vùng thiên thạch.

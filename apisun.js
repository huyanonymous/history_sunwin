const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_JSON_PATH = path.join(__dirname, 'history.json');
const DATA_CSV_PATH = path.join(__dirname, 'history.csv');

let history = [];

// Khởi tạo và tải dữ liệu cũ nếu có
if (fs.existsSync(DATA_JSON_PATH)) {
    try {
        const fileData = fs.readFileSync(DATA_JSON_PATH, 'utf-8');
        history = JSON.parse(fileData);
        console.log(`[Hệ thống] Đã tải thành công ${history.length} phiên cũ.`);
    } catch (error) {
        history = [];
    }
}

// Hàm lưu trữ dữ liệu sang JSON và CSV
function saveData() {
    try {
        history.sort((a, b) => a.phien - b.phien);

        // 1. Lưu file JSON
        fs.writeFileSync(DATA_JSON_PATH, JSON.stringify(history, null, 2), 'utf-8');

        // 2. Lưu file CSV
        const headers = ['Id', 'phien', 'ket_qua', 'xuc_xac_1', 'xuc_xac_2', 'xuc_xac_3', 'tong', 'thoi_gian'];
        const rows = history.map(item => [
            `"${item.Id}"`,
            item.phien,
            `"${item.ket_qua}"`,
            item.xuc_xac_1,
            item.xuc_xac_2,
            item.xuc_xac_3,
            item.tong,
            `"${item.thoi_gian}"`
        ].join(','));
        const csvContent = [headers.join(','), ...rows].join('\n');
        fs.writeFileSync(DATA_CSV_PATH, csvContent, 'utf-8');
    } catch (error) {
        console.error('[Hệ thống] Lỗi khi ghi file:', error.message);
    }
}

// Tự động gọi API thu thập dữ liệu
async function fetchAPI() {
    try {
        const response = await axios.get('https://famous-instruction-heavy-telephony.trycloudflare.com/api/tx', { timeout: 5000 });
        const data = response.data;
        
        if (data && data.phien) {
            // Không trùng lặp mới lưu
            const exists = history.some(item => item.phien === Number(data.phien));
            if (!exists) {
                const newItem = {
                    Id: "@ThienNhanVn",
                    phien: Number(data.phien),
                    ket_qua: data.ket_qua,
                    xuc_xac_1: Number(data.xuc_xac_1),
                    xuc_xac_2: Number(data.xuc_xac_2),
                    xuc_xac_3: Number(data.xuc_xac_3),
                    tong: Number(data.tong),
                    thoi_gian: data.thoi_gian
                };
                history.push(newItem);
                saveData();
                console.log(`[+] Đã lưu phiên mới: ${data.phien} | ${data.ket_qua} (${data.tong})`);
            }
        }
    } catch (error) {
        // im lặng bỏ qua nếu API nghẽn mạng
    }
}

// Tự động quét API mỗi 5 giây
setInterval(fetchAPI, 5000);
fetchAPI();

// Tính toán Uptime
const startTime = Date.now();
function getUptime() {
    const diff = Date.now() - startTime;
    const seconds = Math.floor((diff / 1000) % 60);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return `${days} ngày, ${hours} giờ, ${minutes} phút, ${seconds} giây`;
}

// 1. API: /sunwin/history (Hiển thị list chuẩn format)
app.get('/sunwin/history', (req, res) => {
    // Trả về danh sách ngược (mới nhất hiển thị lên đầu)
    const formattedData = [...history].reverse().map(item => ({
        Id: item.Id,
        phien: item.phien,
        ket_qua: item.ket_qua,
        xuc_xac_1: item.xuc_xac_1,
        xuc_xac_2: item.xuc_xac_2,
        xuc_xac_3: item.xuc_xac_3,
        tong: item.tong
    }));
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(formattedData, null, 2));
});

// 2. Xuất dữ liệu API download trực tiếp
app.get('/api/export/json', (req, res) => {
    fs.existsSync(DATA_JSON_PATH) ? res.download(DATA_JSON_PATH, 'history.json') : res.status(404).send('Chưa có file.');
});
app.get('/api/export/csv', (req, res) => {
    fs.existsSync(DATA_CSV_PATH) ? res.download(DATA_CSV_PATH, 'history.csv') : res.status(404).send('Chưa có file.');
});

// 3. Web UI: /dashboard 
app.get('/dashboard', (req, res) => {
    // 48 phiên vẽ cầu Pattern
    const recentSessions = [...history].reverse().slice(0, 48);
    let patternHtml = '';
    recentSessions.forEach(item => {
        const isTai = item.ket_qua === 'Tài';
        const colorClass = isTai ? 'bg-red-500 text-white' : 'bg-blue-500 text-white';
        const text = isTai ? 'T' : 'X';
        patternHtml += `<div class="w-8 h-8 rounded-full flex items-center justify-center font-bold ${colorClass} text-xs shadow-md" title="Phiên: ${item.phien} - Kết quả: ${item.ket_qua} (${item.tong})">${text}</div>`;
    });

    // 15 phiên cho danh sách bảng
    const tableSessions = [...history].reverse().slice(0, 15);
    let tableRowsHtml = '';
    tableSessions.forEach(item => {
        const isTai = item.ket_qua === 'Tài';
        const badgeClass = isTai ? 'bg-red-100 text-red-800 border-red-200' : 'bg-blue-100 text-blue-800 border-blue-200';
        tableRowsHtml += `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="px-6 py-3 font-semibold text-slate-700">${item.phien}</td>
                <td class="px-6 py-3">
                    <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${badgeClass}">
                        ${item.ket_qua}
                    </span>
                </td>
                <td class="px-6 py-3 text-center">
                    <span class="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-mono font-bold">${item.xuc_xac_1}</span>
                    <span class="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-mono font-bold ml-1">${item.xuc_xac_2}</span>
                    <span class="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-mono font-bold ml-1">${item.xuc_xac_3}</span>
                </td>
                <td class="px-6 py-3 text-center font-extrabold text-indigo-600">${item.tong}</td>
                <td class="px-6 py-3 text-xs text-slate-500 font-medium">${item.thoi_gian}</td>
            </tr>
        `;
    });

    // Giao diện web được nhúng (Styled bằng Tailwind)
    const html = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sunwin Analytics - Quản Lý Hệ Thống</title>
        <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-slate-50 text-slate-800 min-h-screen">
        <div class="max-w-6xl mx-auto px-4 py-8">
            <header class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div>
                    <h1 class="text-2xl font-extrabold text-slate-900 flex items-center gap-2">🎲 Sunwin Auto-Collector</h1>
                    <p class="text-sm text-slate-500 mt-1">Hệ thống theo dõi lịch sử bàn chơi cho ID: <span class="font-bold text-indigo-600 underline">@ThienNhanVn</span></p>
                </div>
                <div class="flex flex-col items-start md:items-end">
                    <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Đang Thu Thập Tự Động
                    </span>
                    <p class="text-xs text-slate-400 mt-1.5">Thời gian hoạt động: <span class="font-bold text-slate-600">${getUptime()}</span></p>
                </div>
            </header>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng dữ liệu đã lưu</div>
                    <div class="text-4xl font-extrabold text-indigo-600 mt-2">${history.length} <span class="text-sm font-normal text-slate-400">phiên</span></div>
                </div>
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Tỷ Lệ Tài / Xỉu</div>
                    <div class="text-2xl font-extrabold text-slate-800 mt-2">
                        Tài: ${history.length > 0 ? ((history.filter(i => i.ket_qua === 'Tài').length / history.length) * 100).toFixed(1) : 0}% | 
                        Xỉu: ${history.length > 0 ? ((history.filter(i => i.ket_qua === 'Xỉu').length / history.length) * 100).toFixed(1) : 0}%
                    </div>
                </div>
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Xuất dữ liệu toàn bộ</div>
                    <div class="grid grid-cols-2 gap-3 mt-4">
                        <a href="/api/export/json" class="text-center bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl text-xs shadow-sm">Xuất JSON</a>
                        <a href="/api/export/csv" class="text-center bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs shadow-sm">Xuất CSV</a>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8">
                <h2 class="text-lg font-extrabold text-slate-900 mb-4">🎯 Biểu Đồ Mẫu Cầu (Pattern)</h2>
                <div class="flex flex-wrap gap-2.5 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                    ${patternHtml || '<p class="text-sm text-slate-400">Chưa có dữ liệu</p>'}
                </div>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-6 border-b border-slate-100 flex justify-between">
                    <h2 class="text-lg font-extrabold text-slate-900">📋 15 Phiên Mới Nhất</h2>
                    <a href="/sunwin/history" target="_blank" class="text-xs font-bold text-indigo-600">Xem Raw JSON →</a>
                </div>
                <table class="w-full text-left">
                    <thead class="bg-slate-50/70 text-[11px] uppercase border-b text-slate-400">
                        <tr>
                            <th class="px-6 py-3.5">Phiên</th><th class="px-6 py-3.5">Kết Quả</th>
                            <th class="px-6 py-3.5 text-center">Xúc Xắc</th><th class="px-6 py-3.5 text-center">Tổng</th>
                            <th class="px-6 py-3.5">Thời Gian</th>
                        </tr>
                    </thead>
                    <tbody class="text-sm">${tableRowsHtml}</tbody>
                </table>
            </div>
        </div>
        <script>
            setTimeout(() => { window.location.reload(); }, 10000); // Reload trang quản lý mỗi 10s
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

app.listen(PORT, () => {
    console.log(`[+] Server đã chạy tại port ${PORT}`);
});

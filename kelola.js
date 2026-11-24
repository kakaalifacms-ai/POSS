// ==========================================
// 1. IMPORT FIREBASE
// ==========================================

import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs
} from
"https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ==========================================
// 2. FIREBASE CONFIG & IDENTITAS KASIR
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyA6I1Tvw61wzc6-2MVmcWXfZ17IwDYj7u4",
  authDomain: "rpl25-b6db4.firebaseapp.com",
  projectId: "rpl25-b6db4",
  storageBucket: "rpl25-b6db4.firebasestorage.app",
  messagingSenderId: "643920833293",
  appId: "1:643920833293:web:f5ac7fdc746e4e410d5e44"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Identitas khusus kasir Kaka
const KASIR_ID = "KASIR001";
const NAMA_KASIR = "Kaka";

// Referensi subcollection menu khusus milik KASIR001
const menuRef = collection(db, "kasir", KASIR_ID, "menu");


// ==========================================
// 3. STATE & ELEMEN DOM
// ==========================================

const formMenu = document.getElementById("form-menu");
const formJudul = document.getElementById("form-judul");
const editIdInput = document.getElementById("edit-id");
const inputNama = document.getElementById("input-nama");
const inputHarga = document.getElementById("input-harga");
const inputGambar = document.getElementById("input-gambar");
const previewGambar = document.getElementById("preview-gambar");
const infoGambar = document.getElementById("info-gambar");
const btnSimpan = document.getElementById("btn-simpan");
const btnBatal = document.getElementById("btn-batal");
const btnSeedDefault = document.getElementById("btn-seed-default");

const PLACEHOLDER_SVG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100%' height='100%' fill='%23e2e8f0'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-family='sans-serif' font-size='11'>Preview</text></svg>";

let gambarBase64Terpilih = "";
let sedangMenyimpan = false;


// ==========================================
// 4. UTILITAS (FORMAT RUPIAH & NOTIFIKASI)
// ==========================================

function formatRupiah(angka) {
  return "Rp" + Number(angka || 0).toLocaleString("id-ID");
}

function tampilkanNotifikasi(pesan, ikon = "✅") {
  const notif = document.getElementById("notifikasi-kasir");
  notif.innerHTML = `
    <div style="font-size:36px;">${ikon}</div>
    <h3>${pesan}</h3>
  `;
  notif.classList.remove("hidden");

  setTimeout(() => {
    notif.classList.add("hidden");
  }, 3000);
}


// ==========================================
// 5. KOMPRESI GAMBAR DARI GALERI
// ==========================================

function prosesGambarDariGaleri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxUkuran = 400;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxUkuran) {
          height = Math.round((height * maxUkuran) / width);
          width = maxUkuran;
        } else if (height > maxUkuran) {
          width = Math.round((width * maxUkuran) / height);
          height = maxUkuran;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
        resolve(dataUrl);
      };

      img.onerror = () => reject(new Error("File bukan gambar yang valid."));
      img.src = e.target.result;
    };

    reader.onerror = () => reject(new Error("Gagal membaca file dari galeri."));
    reader.readAsDataURL(file);
  });
}

inputGambar.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    infoGambar.textContent = "Memproses foto...";
    const hasilBase64 = await prosesGambarDariGaleri(file);
    gambarBase64Terpilih = hasilBase64;
    previewGambar.src = hasilBase64;
    infoGambar.textContent = `Foto siap disimpan (${file.name})`;
  } catch (error) {
    console.error(error);
    alert(error.message);
    inputGambar.value = "";
    infoGambar.textContent = "Gagal memuat gambar.";
  }
});


// ==========================================
// 6. RESET FORM & MODE EDIT
// ==========================================

function resetForm() {
  editIdInput.value = "";
  formMenu.reset();
  gambarBase64Terpilih = "";
  previewGambar.src = PLACEHOLDER_SVG;
  infoGambar.textContent = "Pilih gambar dari galeri HP/PC (otomatis dikompresi).";
  formJudul.textContent = "➕ Tambah Menu Baru";
  btnSimpan.textContent = "💾 Simpan Menu";
  btnBatal.classList.add("hidden");
}

btnBatal.addEventListener("click", resetForm);

function mulaiEditMenu(id, item) {
  editIdInput.value = id;
  inputNama.value = item.nama;
  inputHarga.value = item.harga;
  inputGambar.value = "";

  gambarBase64Terpilih = item.gambar || "";
  previewGambar.src = item.gambar || PLACEHOLDER_SVG;
  infoGambar.textContent = "Biarkan kosong jika tidak ingin mengganti foto.";

  formJudul.textContent = "✏️ Edit Menu";
  btnSimpan.textContent = "🔄 Simpan Perubahan";
  btnBatal.classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}


// ==========================================
// 7. CREATE & UPDATE MENU (KHUSUS KASIR001)
// ==========================================

formMenu.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (sedangMenyimpan) return;

  const nama = inputNama.value.trim();
  const harga = Number(inputHarga.value);
  const idEdit = editIdInput.value;

  if (!nama || !Number.isFinite(harga) || harga <= 0) {
    alert("Masukkan nama menu dan harga yang valid.");
    return;
  }

  sedangMenyimpan = true;
  btnSimpan.disabled = true;
  btnSimpan.textContent = "Menyimpan...";

  try {
    if (idEdit) {
      // UPDATE DATA di kasir/KASIR001/menu/{idEdit}
      const refDokumen = doc(db, "kasir", KASIR_ID, "menu", idEdit);
      await updateDoc(refDokumen, {
        kasirId: KASIR_ID,
        namaKasir: NAMA_KASIR,
        nama: nama,
        harga: harga,
        gambar: gambarBase64Terpilih,
        diperbarui: Date.now()
      });

      tampilkanNotifikasi("Menu Kaka Berhasil Diperbarui!");
    } else {
      // CREATE DATA BARU di kasir/KASIR001/menu
      await addDoc(menuRef, {
        kasirId: KASIR_ID,
        namaKasir: NAMA_KASIR,
        nama: nama,
        harga: harga,
        gambar: gambarBase64Terpilih,
        waktuBuat: Date.now()
      });

      tampilkanNotifikasi("Menu Baru Kaka Ditambahkan!");
    }

    resetForm();
  } catch (error) {
    console.error("Gagal menyimpan menu:", error);
    alert("Gagal menyimpan ke Firebase. Periksa koneksi internet Anda.");
  } finally {
    sedangMenyimpan = false;
    btnSimpan.disabled = false;
    if (!editIdInput.value) {
      btnSimpan.textContent = "💾 Simpan Menu";
    }
  }
});


// ==========================================
// 8. DELETE MENU (KHUSUS KASIR001)
// ==========================================

async function hapusMenu(id, nama) {
  const konfirmasi = confirm(`Yakin ingin menghapus menu "${nama}" milik ${NAMA_KASIR}?`);
  if (!konfirmasi) return;

  try {
    await deleteDoc(doc(db, "kasir", KASIR_ID, "menu", id));
    if (editIdInput.value === id) {
      resetForm();
    }
    tampilkanNotifikasi("Menu Berhasil Dihapus!", "🗑️");
  } catch (error) {
    console.error("Gagal menghapus menu:", error);
    alert("Gagal menghapus data menu.");
  }
}


// ==========================================
// 9. READ MENU REAL-TIME (KHUSUS KASIR001)
// ==========================================

const queryMenu = query(menuRef, orderBy("waktuBuat", "asc"));

onSnapshot(
  queryMenu,
  (snapshot) => {
    const container = document.getElementById("daftar-kelola-menu");
    const jumlahEl = document.getElementById("jumlah-menu");

    jumlahEl.textContent = snapshot.size;
    container.innerHTML = "";

    if (snapshot.empty) {
      container.innerHTML = `
        <p class="keranjang-kosong" style="grid-column: 1 / -1;">
          Belum ada data menu untuk <b>${NAMA_KASIR} (${KASIR_ID})</b>. Tambahkan lewat form di atas atau klik <b>Isi 6 Menu Awal</b>.
        </p>
      `;
      return;
    }

    snapshot.forEach((dokumen) => {
      const id = dokumen.id;
      const item = dokumen.data();

      const card = document.createElement("div");
      card.className = "menu-card";

      const img = document.createElement("img");
      img.src = item.gambar || PLACEHOLDER_SVG;
      img.alt = item.nama;
      img.onerror = () => {
        img.src = PLACEHOLDER_SVG;
      };

      const judul = document.createElement("h3");
      judul.textContent = item.nama;

      const harga = document.createElement("p");
      harga.textContent = formatRupiah(item.harga);

      const aksi = document.createElement("div");
      aksi.className = "crud-actions";

      const btnEdit = document.createElement("button");
      btnEdit.type = "button";
      btnEdit.className = "btn-edit";
      btnEdit.textContent = "✏️ Edit";
      btnEdit.addEventListener("click", () => mulaiEditMenu(id, item));

      const btnHapus = document.createElement("button");
      btnHapus.type = "button";
      btnHapus.className = "btn-hapus";
      btnHapus.textContent = "🗑️ Hapus";
      btnHapus.addEventListener("click", () => hapusMenu(id, item.nama));

      aksi.append(btnEdit, btnHapus);
      card.append(img, judul, harga, aksi);
      container.appendChild(card);
    });
  },
  (error) => {
    console.error("Gagal membaca daftar menu:", error);
  }
);


// ==========================================
// 10. ISI 6 MENU DEFAULT KE KASIR001 (OPSIONAL)
// ==========================================

btnSeedDefault.addEventListener("click", async () => {
  btnSeedDefault.disabled = true;
  btnSeedDefault.textContent = "Memproses...";

  try {
    const cekSnapshot = await getDocs(menuRef);
    if (!cekSnapshot.empty) {
      const lanjut = confirm(`Menu ${NAMA_KASIR} sudah terisi. Tetap tambahkan 6 menu awal?`);
      if (!lanjut) return;
    }

    const menuAwal = [
      { nama: "🍜 Mie Ayam", harga: 15000, gambar: "gambar/mieayam2.jpg" },
      { nama: "🍗 Ayam Geprek Jago", harga: 30000, gambar: "gambar/ayam-geprek.jpg" },
      { nama: "🍛 Nasi Goreng Pedas", harga: 15000, gambar: "gambar/nasi-goreng.jpg" },
      { nama: "🍹 Es Teh Manis", harga: 5000, gambar: "gambar/es-teh.jpg" },
      { nama: "🍩 Donat", harga: 5000, gambar: "gambar/donat.jpg" },
      { nama: "🐐 Sate Kambing", harga: 25000, gambar: "gambar/sate-kambing.jpg" }
    ];

    const waktuDasar = Date.now();
    for (let i = 0; i < menuAwal.length; i++) {
      await addDoc(menuRef, {
        kasirId: KASIR_ID,
        namaKasir: NAMA_KASIR,
        ...menuAwal[i],
        waktuBuat: waktuDasar + i
      });
    }

    tampilkanNotifikasi("6 Menu Awal Berhasil Dimuat ke KASIR001!");
  } catch (error) {
    console.error("Gagal mengisi menu awal:", error);
    alert("Gagal memuat menu awal.");
  } finally {
    btnSeedDefault.disabled = false;
    btnSeedDefault.textContent = "📥 Isi 6 Menu Awal";
  }
});

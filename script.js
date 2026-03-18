// ==========================================
// 1. CONFIGURACIÓN INICIAL
// ==========================================
let lat = 43.3614; // Coordenadas por defecto (A Coruña)
let lon = -8.4105;
let myChart; 
let currentPhotoBase64 = "";

// Iniciar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
    getMarineData();
    displayLogs();
});

// ==========================================
// 2. DATOS METEOROLÓGICOS Y GRÁFICO
// ==========================================
async function getMarineData() {
    // Evitamos pedir GPS si estamos abriendo el archivo localmente (file://)
    if (navigator.geolocation && window.location.protocol !== 'file:') {
        navigator.geolocation.getCurrentPosition(position => {
            lat = position.coords.latitude;
            lon = position.coords.longitude;
            fetchWeather(lat, lon);
        }, () => fetchWeather(lat, lon)); // Fallback a coords por defecto si rechaza el GPS
    } else {
        fetchWeather(lat, lon); // Fallback directo
    }
}

async function fetchWeather(lat, lon) {
    const urlMarine = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height&hourly=wave_height&timezone=auto&forecast_days=1`;
    const urlWind = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_direction_10m&timezone=auto`;
    // Esta línea actualiza el mapa a la posición del GPS
    const windyIframe = document.getElementById('windy-map');
    if (windyIframe) {
        windyIframe.src = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&zoom=11&level=surface&overlay=wind&product=ecmwf&menu=&message=&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
    }
    try {
        const [marineRes, windRes] = await Promise.all([
            fetch(urlMarine).then(r => r.json()),
            fetch(urlWind).then(r => r.json())
        ]);

        document.getElementById('wave-height').innerText = marineRes.current.wave_height;
        document.getElementById('wind-speed').innerText = windRes.current.wind_speed_10m;
        
        const dir = windRes.current.wind_direction_10m;
        document.getElementById('wind-direction').innerText = `Dirección: ${dir}° (${getWindCardinal(dir)})`;

        renderChart(marineRes.hourly);
    } catch (err) {
        console.error("Error cargando APIs:", err);
    }
}

function getWindCardinal(deg) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    return directions[Math.round(deg / 45) % 8];
}

function renderChart(hourlyData) {
    const ctx = document.getElementById('tideChart').getContext('2d');
    if (myChart) myChart.destroy();

    const labels = hourlyData.time.map(t => t.split('T')[1]);
    const values = hourlyData.wave_height;

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Altura de ola (m)',
                data: values,
                borderColor: '#38bdf8',
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 8 } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// ==========================================
// 3. DIARIO DE PESCA (BITÁCORA) Y LOCALSTORAGE
// ==========================================
document.getElementById('fish-photo').addEventListener('change', function(e) {
    if(!e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            const scale = 800 / img.width;
            canvas.width = 800;
            canvas.height = img.height * scale;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            currentPhotoBase64 = canvas.toDataURL('image/jpeg', 0.7);
            document.getElementById('photo-label').innerText = "✅ Foto lista";
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(e.target.files[0]);
});

document.getElementById('save-log').addEventListener('click', () => {
    const species = document.getElementById('fish-species').value;
    const weight = document.getElementById('fish-weight').value;
    
    if(!species || !weight) return alert("Rellena los datos, patrón.");

    const newLog = {
        id: Date.now(),
        date: new Date().toLocaleDateString(),
        species,
        weight,
        photo: currentPhotoBase64
    };

    let logs = JSON.parse(localStorage.getItem('fishingLogs') || '[]');
    
    // Autolimpieza si pasamos de 4.5MB
    while (getLocalStorageSize() > 4.5 && logs.length > 0) {
        logs.pop(); 
    }

    logs.unshift(newLog); 
    
    try {
        localStorage.setItem('fishingLogs', JSON.stringify(logs));
        // Resetear formulario
        document.getElementById('fish-species').value = '';
        document.getElementById('fish-weight').value = '';
        currentPhotoBase64 = "";
        document.getElementById('photo-label').innerText = "📸 Añadir Foto";
        displayLogs();
    } catch (e) {
        alert("¡Cuidado! La memoria está llena.");
    }
});
function displayLogs() {
    const logs = JSON.parse(localStorage.getItem('fishingLogs') || '[]');
    const container = document.getElementById('log-container');
    
    container.innerHTML = logs.map(log => `
    <div class="bg-slate-700 p-4 rounded-2xl flex justify-between items-center border-l-4 border-blue-500 shadow-lg">            <div class="flex items-center gap-3">
        ${log.photo ? `<img src="${log.photo}" class="w-20 h-20 rounded-xl object-cover shadow-md border border-slate-600">` : ''}                <div>
                    <p class="font-bold text-white">${log.species} <span class="text-sm font-normal text-slate-400">(${log.weight}kg)</span></p>
                    <p class="text-xs text-slate-400">${log.date}</p>
                </div>
            </div>
            <div class="flex flex-col gap-1 items-end">
                <button onclick="shareLog(${log.id})" class="text-green-400 font-bold text-sm bg-green-900/30 px-2 py-1 rounded">📲 Compartir</button>
                <button onclick="deleteLog(${log.id})" class="text-red-400 text-xs italic">Borrar</button>
            </div>
        </div>
    `).join('');
    
    updateStorageUI();
}

// Hacer deleteLog global para que el onClick del HTML la encuentre
window.deleteLog = function(id) {
    let logs = JSON.parse(localStorage.getItem('fishingLogs') || '[]');
    logs = logs.filter(log => log.id !== id);
    localStorage.setItem('fishingLogs', JSON.stringify(logs));
    displayLogs();
}

function getLocalStorageSize() {
    let total = 0;
    for (let x in localStorage) {
        if (localStorage.hasOwnProperty(x)) {
            total += ((localStorage[x].length + x.length) * 2); 
        }
    }
    return (total / 1024 / 1024).toFixed(2); 
}

function updateStorageUI() {
    const size = getLocalStorageSize();
    const percentage = Math.min((size / 5 * 100), 100).toFixed(0); 
    const bar = document.getElementById('storage-bar');
    
    bar.style.width = `${percentage}%`;
    document.getElementById('storage-text').innerText = `Memoria del Barco: ${percentage}% (${size}MB / 5MB)`;
    
    if(percentage > 80) {
        bar.classList.remove('bg-blue-500');
        bar.classList.add('bg-orange-500');
    } else {
        bar.classList.add('bg-blue-500');
        bar.classList.remove('bg-orange-500');
    }
}

// ==========================================
// 4. FUNCIONES DE WHATSAPP / SOS
// ==========================================
document.getElementById('export-whatsapp').addEventListener('click', () => {
    const logs = JSON.parse(localStorage.getItem('fishingLogs') || '[]');
    if(logs.length === 0) return alert("No hay capturas que compartir.");

    let text = ` *REGISTRO DE PESCA* \n\n`;
    logs.forEach(log => {
        text += ` *${log.species}* (${log.weight}kg) - ${log.date}\n`;
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
});

// --- Lógica de Configuración ---
document.getElementById('save-config').addEventListener('click', () => {
    let phone = document.getElementById('config-phone').value.trim();
    
    // Quitamos espacios, guiones o el símbolo + si los hubiera
    phone = phone.replace(/\s+/g, '').replace(/-/g, '').replace(/\+/g, '');

    if(phone) {
        // Si el número empieza por 6 o 7 (móviles España) y no tiene el 34 delante
        if ((phone.startsWith('6') || phone.startsWith('7')) && !phone.startsWith('34')) {
            phone = '34' + phone;
        }
        
        localStorage.setItem('emergencyPhone', phone);
        alert(`Configurado con éxito: +${phone}`);
        document.getElementById('config-phone').value = phone;
    } else {
        alert("Introduce un número válido.");
    }
});

// Cargar el teléfono si ya existe al abrir la web
document.addEventListener('DOMContentLoaded', () => {
    const savedPhone = localStorage.getItem('emergencyPhone');
    if(savedPhone) document.getElementById('config-phone').value = savedPhone;
});

// --- Botón SOS Modificado ---
document.getElementById('sos-btn').addEventListener('click', () => {
    const phone = localStorage.getItem('emergencyPhone');
    
    if(!phone) {
        alert("Primero debes configurar el teléfono de emergencia en la sección de Ajustes (abajo del todo).");
        return;
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const accuracy = position.coords.accuracy.toFixed(0);
            
            const message = encodeURIComponent(
                `¡EMERGENCIA EN EL MAR! \n\n` +
                `Necesito ayuda. Mi ubicación actual es:\n` +
                ` https://maps.google.com/?q=${lat},${lon}\n` +
                `Precisión: ${accuracy}m.`
            );

            window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
        }, () => alert("GPS desactivado."), { enableHighAccuracy: true });
    }
});

// ==========================================
// 5. SERVICE WORKER (PWA)
// ==========================================
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registrado', reg))
      .catch(err => console.log('Error al registrar SW', err));
  });
}

// Convierte nuestra foto comprimida de vuelta a un archivo real
function base64ToFile(base64Data, filename) {
    const arr = base64Data.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

// Función mágica para invocar el menú de compartir del móvil
window.shareLog = async function(id) {
    const logs = JSON.parse(localStorage.getItem('fishingLogs') || '[]');
    const log = logs.find(l => l.id === id);
    if (!log) return;

    // Preparamos el mensaje
    const shareData = {
        title: '¡Mira lo que he pescado!',
        text: ` ¡Nueva captura! Un ${log.species} de ${log.weight}kg. Pescado el ${log.date}.`
    };

    // Si la captura tiene foto, la empaquetamos
    if (log.photo) {
        const file = base64ToFile(log.photo, `captura-${log.id}.jpg`);
        shareData.files = [file];
    }

    try {
        // Comprobamos si el móvil soporta compartir archivos nativamente
        if (navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);
        } else {
            // Plan B: Si el navegador es antiguo o estamos en PC, abrimos WhatsApp solo con texto
            alert("Tu navegador no soporta compartir fotos. Enviando solo texto...");
            const waUrl = `https://wa.me/?text=${encodeURIComponent(shareData.text)}`;
            window.open(waUrl, '_blank');
        }
    } catch (err) {
        console.log('Compartir cancelado o fallido', err);
    }
}
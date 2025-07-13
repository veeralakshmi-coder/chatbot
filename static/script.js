console.log("JS loaded!");

const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const historyList = document.getElementById("history-list");
const clearBtn = document.getElementById("clear-history");
const micBtn = document.getElementById("mic-btn");
const listeningIndicator = document.getElementById("listening-indicator");
const toggleBtn = document.getElementById("toggle-theme");
const plusBtn = document.getElementById("plus-btn");
const toolMenu = document.getElementById("tool-menu");

// 🌙 Toggle Theme
toggleBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  toggleBtn.textContent = document.body.classList.contains("dark-mode") ? "☀️ Light Mode" : "🌙 Dark Mode";
});


// ➕ Show/Hide Tool Menu
plusBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  toolMenu.classList.toggle("hidden");
});

document.addEventListener("click", (e) => {
  if (!toolMenu.contains(e.target) && e.target !== plusBtn) {
    toolMenu.classList.add("hidden");
  }
});


// 🎤 Voice Input
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  micBtn.addEventListener("click", () => {
    recognition.start();
    micBtn.style.background = "#ffa500";
    listeningIndicator.style.display = "inline";
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    micBtn.style.background = "#10a37f";
    listeningIndicator.style.display = "none";
  };

  recognition.onerror = () => {
    micBtn.style.background = "#10a37f";
    listeningIndicator.style.display = "none";
  };

  recognition.onend = () => {
    micBtn.style.background = "#10a37f";
    listeningIndicator.style.display = "none";
  };
} else {
  micBtn.style.display = "none";
  listeningIndicator.style.display = "none";
}

// 🔁 Load Chat History
window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("/history");
    const history = await res.json();

    history.forEach((msg) => appendMessage(msg.text, msg.sender));

    history.forEach((msg) => {
      if (msg.sender === "user") {
        const li = document.createElement("li");
        li.textContent = msg.text.slice(0, 40);
        li.title = msg.text;
        li.addEventListener("click", () => scrollToMessage(msg.text));
        historyList.appendChild(li);
      }
    });

    if (history.length === 0) {
      appendMessage("👋 How can I help you today?", "bot");
    }

    const downloadBtn = document.getElementById("download-chat");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => {
        const chatText = Array.from(document.querySelectorAll("#chat-box .msg"))
          .map(msg => msg.textContent)
          .join("\n\n");

        const blob = new Blob([chatText], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "chat.txt";
        link.click();
      });
    }

    showQuickReplies(["What is HTML?", "Tell me a joke", "Help me cook dinner"]);
  } catch (err) {
    console.error("Error loading history:", err);
  }
});

// 📨 Handle Message Submit
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  const fileInput = document.getElementById("file-input");
  const file = fileInput.files[0];

  if (!text && !file) return;

  input.value = "";
  fileInput.value = "";
  appendMessage(text || "📎 File sent", "user");

  const typingBubble = showTyping();

  const formData = new FormData();
  formData.append("message", text);
  if (file) formData.append("file", file);

  try {
    const res = await fetch("/chat", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    removeTyping(typingBubble);
    appendMessage(data.reply, "bot");
  } catch (err) {
    console.error("Error:", err);
    removeTyping(typingBubble);
    appendMessage("⚠ Something went wrong.", "bot");
  }
});


// 🧹 Clear Chat
if (clearBtn) {
  clearBtn.addEventListener("click", async () => {
    await fetch("/clear", { method: "POST" });
    chatBox.innerHTML = "";
    historyList.innerHTML = "";
  });
}

// 📦 Append Message with Bot Toolbar
function appendMessage(text, senderType) {
  const msg = document.createElement("div");
  msg.className = `msg ${senderType}`;
  msg.setAttribute("data-msg", text);
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (senderType === "bot") {
    msg.innerHTML = `
      <span>${text}</span>
      <div class="timestamp">${time}</div>
      <div class="bot-toolbar">
        <button onclick="copyText(this)" title="Copy"><i class="fas fa-copy"></i></button>
        <button onclick="likeMessage(this)" title="Like"><i class="fas fa-thumbs-up"></i></button>
        <button onclick="dislikeMessage(this)" title="Dislike"><i class="fas fa-thumbs-down"></i></button>
        <button onclick="speakText(\`${text.replace(/`/g, "\\`")}\`)" title="Speak"><i class="fas fa-volume-up"></i></button>
            <button onclick="deleteMessagePair(\`${text.replace(/`/g, "\\`")}\`)" title="Delete"><i class="fas fa-trash"></i></button>

      </div>
    `;
  } else {
 msg.innerHTML = `
  <span>${text}</span>
  <div class="timestamp">${time}</div>
  <div class="bot-toolbar">
    <button onclick="copyText(this)" title="Copy"><i class="fas fa-copy"></i></button>
    
    <button onclick="speakText(\`${text.replace(/`/g, "\\`")}\`)" title="Speak"><i class="fas fa-volume-up"></i></button>
    <button onclick="deleteMessagePair(\`${text.replace(/`/g, "\\`")}\`)" title="Delete"><i class="fas fa-trash"></i></button>
  </div>
`;



  }

  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msg;
}

// 🟡 Toolbar Actions
function copyText(btn) {
  const text = btn.closest(".msg").querySelector("span").innerText;
  navigator.clipboard.writeText(text);
  const icon = btn.querySelector("i");
  icon.className = "fas fa-check";
  setTimeout(() => icon.className = "fas fa-copy", 1000);
}

function likeMessage(btn) {
  const icon = btn.querySelector("i");
  icon.className = "fas fa-check";
  setTimeout(() => icon.className = "fas fa-thumbs-up", 1000);
}

function dislikeMessage(btn) {
  const icon = btn.querySelector("i");
  icon.className = "fas fa-check";
  setTimeout(() => icon.className = "fas fa-thumbs-down", 1000);
}


async function deleteMessagePair(botText) {
  const res = await fetch("/delete_message_pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bot_text: botText })
  });

  const result = await res.json();
  if (result.success) {
    window.location.reload();  // Reload to reflect deletion
  } else {
    alert("❌ Failed to delete message: " + result.error);
  }
}


// 💬 Typing Indicator
function showTyping() {
  const typing = document.createElement("div");
  typing.className = "msg bot typing";
  typing.id = "typing-indicator";
  typing.innerHTML = `
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>`;
  chatBox.appendChild(typing);
  chatBox.scrollTop = chatBox.scrollHeight;
  return typing;
}

// ❌ Remove Typing
function removeTyping(el) {
  if (el && el.parentNode) el.remove();
}

// 🧭 Scroll to Message
function scrollToMessage(content) {
  const messages = document.querySelectorAll(".msg");
  for (let m of messages) {
    if (m.getAttribute("data-msg") === content) {
      m.scrollIntoView({ behavior: "smooth", block: "center" });
      m.style.backgroundColor = "#ffffcc";
      setTimeout(() => (m.style.backgroundColor = ""), 1000);
      break;
    }
  }
}

// 🔊 Speak Text
function speakText(text) {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.pitch = 1;
    utterance.rate = 1;
    speechSynthesis.speak(utterance);
  }
}

// 💡 Quick Replies
function showQuickReplies(suggestions) {
  const container = document.getElementById("quick-replies");
  if (!container) return;
  container.innerHTML = "";
  suggestions.forEach(text => {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.onclick = () => {
      input.value = text;
      form.dispatchEvent(new Event("submit"));
    };
    container.appendChild(btn);
  });
}

// ⚙️ Open Modals
document.getElementById("settings-btn")?.addEventListener("click", () => {
  document.getElementById("settings-modal").style.display = "block";
});
document.getElementById("help-btn")?.addEventListener("click", () => {
  document.getElementById("help-modal").style.display = "block";
});
function closeModal(modalId) {
  document.getElementById(modalId).style.display = "none";
}
window.addEventListener("click", (e) => {
  if (e.target.id === "settings-modal") closeModal("settings-modal");
  if (e.target.id === "help-modal") closeModal("help-modal");
});  



async function deleteMessagePair(userText) {
  const res = await fetch("/delete_message_pair", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_text: userText })
  });

  const result = await res.json();
  if (result.success) {
    // Reload chat history after deletion
    window.location.reload();
  } else {
    alert("❌ Failed to delete message: " + result.error);
  }
}








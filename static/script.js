console.log("JS loaded!");

const form = document.getElementById("chat-form");
const input = document.getElementById("user-input");
const chatBox = document.getElementById("chat-box");
const historyList = document.getElementById("history-list");
const clearBtn = document.getElementById("clear-history");

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("/history");
    const history = await res.json();

    // Show messages in main chat area
    history.forEach((msg) => {
      appendMessage(msg.text, msg.sender);
    });

    // Add clickable items to left history sidebar
    history.forEach((msg) => {
      if (msg.sender === "user") {
        const li = document.createElement("li");
        li.textContent = msg.text.slice(0, 40);
        li.title = msg.text;

       

        // ✅ Attach click event to scroll
        li.addEventListener("click", () => {
          scrollToMessage(msg.text);
        });

        historyList.appendChild(li);
      }
    });

  } catch (err) {
    console.error("Error loading history:", err);
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  input.value = "";

  appendMessage(text, "user");
  const typingBubble = appendMessage("Typing...", "bot");

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });

    const data = await res.json();

    // Remove the "Typing..." bubble
    if (typingBubble) {
      chatBox.removeChild(typingBubble);
    }

    appendMessage(data.reply, "bot");
  } catch (err) {
    console.error("Error sending message:", err);
    if (typingBubble) chatBox.removeChild(typingBubble);
    appendMessage("⚠️ Something went wrong.", "bot");
  }
});

if (clearBtn) {
  clearBtn.addEventListener("click", async () => {
    await fetch("/clear", { method: "POST" });
    chatBox.innerHTML = "";
    historyList.innerHTML = "";
  });
}

function appendMessage(text, senderType) {
  const msg = document.createElement("div");
  msg.className = `msg ${senderType}`;
  msg.textContent = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msg;
}

function scrollToMessage(content) {
  const messages = document.querySelectorAll(".msg");
  for (let m of messages) {
    if (m.textContent === content) {
      m.scrollIntoView({ behavior: "smooth", block: "center" });

      // Optional: highlight effect
      m.style.backgroundColor = "#ffffcc";
      setTimeout(() => {
        m.style.backgroundColor = "";
      }, 1000);

      break;
    }
  }
}

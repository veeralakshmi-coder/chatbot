from flask import Flask, render_template, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv
import os, requests, time


load_dotenv()
app = Flask(__name__)
CORS(app)  # Optional: Helps prevent CORS errors for JS fetch

# === Database Config ===
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///chat_history.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

# === OpenRouter Config ===
API_URL = "https://openrouter.ai/api/v1/chat/completions"
API_KEY = os.getenv("OPENROUTER_API_KEY")

# === Message Model ===
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender = db.Column(db.String(10))  # 'user' or 'bot'
    text = db.Column(db.Text)
    
with app.app_context():
    db.create_all()

# === Routes ===

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    user_input = request.json.get("message", "")
    db.session.add(Message(sender="user", text=user_input))

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_KEY}"
    }

    body = {
      "model": "mistralai/mistral-7b-instruct",  # You can also try: "mistralai/mistral-7b-instruct"
        "messages": [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": user_input}
        ]
    }

    try:
        start = time.time()
        res = requests.post(API_URL, headers=headers, json=body, timeout=10)
        end = time.time()

        print(f"⏱ OpenRouter API took {end - start:.2f} seconds")

        data = res.json()
        print("🔍 Full API response:", data)  # <== Add this to debug

        # ✅ Properly check if 'choices' has a valid response
        if "choices" in data and len(data["choices"]) > 0:
            reply = data["choices"][0]["message"]["content"]
        else:
            reply = "⚠️ No valid response from the model."

    except Exception as e:
        reply = f"❌ Error: {str(e)}"

    db.session.add(Message(sender="bot", text=reply))
    db.session.commit()

    return jsonify({"reply": reply})


@app.route("/history")
def history():
    msgs = Message.query.all()
    data = [{"sender": m.sender, "text": m.text, "type": m.sender} for m in msgs]
    return jsonify(data)


@app.route("/clear", methods=["POST"])
def clear():
    Message.query.delete()
    db.session.commit()
    return jsonify({"message": "Chat history cleared."})

if __name__ == "__main__":
    app.run(debug=True)

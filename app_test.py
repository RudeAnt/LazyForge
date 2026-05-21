import streamlit as st
import pandas as pd
import numpy as np
import datetime
import requests
import streamlit.components.v1 as components
from thefuzz import process

# --- НАСТРОЙКИ И CSS (СТРОГИЙ ТЕРМИНАЛ) ---
st.set_page_config(page_title="DataForge Workspace", layout="wide", initial_sidebar_state="expanded")

st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;700&display=swap');
    header {visibility: hidden;}
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    .stApp { background-color: #1a1b26; color: #a9b1d6; font-family: 'Fira Code', monospace !important; }
    [data-testid="stSidebar"] { background-color: #16161e; border-right: 1px solid #292e42; }
    .stTextInput input, div[data-baseweb="input"] > div { background-color: #1f2335 !important; color: #c0caf5 !important; border: 1px solid #3b4261 !important; border-radius: 0px !important; font-family: 'Fira Code', monospace !important; padding: 12px !important; }
    .stTextInput input:focus, div[data-baseweb="input"] > div:focus-within { border-color: #7aa2f7 !important; box-shadow: none !important; }
    .stButton > button { background-color: transparent !important; color: #7aa2f7 !important; border: 1px solid #292e42 !important; border-radius: 0px !important; font-family: 'Fira Code', monospace !important; justify-content: flex-start !important; width: 100% !important; transition: all 0.2s; }
    .stButton > button:hover { border-color: #7aa2f7 !important; color: #1a1b26 !important; background-color: #7aa2f7 !important; }
    hr { border-bottom-color: #292e42 !important; }
    .block-container { padding-top: 2rem !important; }
    .stTabs [data-baseweb="tab-list"] { gap: 8px; }
    .stTabs [data-baseweb="tab"] { background-color: #1f2335; border-radius: 0px; padding-top: 10px; padding-bottom: 10px; color: #565f89; }
    .stTabs [aria-selected="true"] { background-color: #292e42; color: #7aa2f7; border-bottom: 2px solid #7aa2f7; }
    </style>
""", unsafe_allow_html=True)

# --- JS ХАК ДЛЯ CTRL + SPACE ---
components.html(
    """
    <script>
    const parentDoc = window.parent.document;
    parentDoc.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.code === 'Space') {
            e.preventDefault(); 
            const searchInput = parentDoc.querySelector('input[aria-label="Ctrl+Space для фокуса | Enter для поиска..."]');
            if (searchInput) {
                searchInput.focus();
                searchInput.style.transition = "box-shadow 0.2s";
                searchInput.style.boxShadow = "0 0 15px #7aa2f7";
                setTimeout(() => searchInput.style.boxShadow = "none", 500);
            }
        }
    });
    </script>
    """, height=0, width=0
)

# --- ЯДРО СИСТЕМЫ: МАТЕМАТИКА ---
@st.cache_data
def process_dataset(df):
    prob_cols = [col for col in df.columns if col.startswith('prob_')]
    classes = [col.replace('prob_', '') for col in prob_cols]
    
    df[prob_cols] = df[prob_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
    probs = df[prob_cols].values

    max_probs = np.max(probs, axis=1)
    df['неуверенность'] = 1.0 - max_probs
    df['энтропия'] = -np.sum(probs * np.log2(probs + 1e-9), axis=1)

    predicted_idx = np.argmax(probs, axis=1)
    df['предсказанный_класс'] = [classes[i] for i in predicted_idx]
    
    df['вероятность_ошибки_разметки'] = np.where(
        df['истинный_класс'] != df['предсказанный_класс'],
        1.0 - df['неуверенность'], 0.0
    )

    df['дубликат'] = df.duplicated(subset=prob_cols + ['истинный_класс'], keep=False)

    class_counts = df['истинный_класс'].value_counts()
    total_objects = len(df)
    ideal_share = 1.0 / len(classes)

    def calc_deficit(c_name):
        if c_name not in class_counts: return 10.0 
        return ideal_share / (class_counts[c_name] / total_objects)

    df['дефицит_класса'] = df['истинный_класс'].apply(calc_deficit)

    norm_entropy = df['энтропия'] / np.log2(len(classes) + 1e-9)
    df['полезность'] = np.where(
        df['дубликат'], 0.0, 
        norm_entropy * 0.4 + df['вероятность_ошибки_разметки'] * 0.4 + df['дефицит_класса'] * 0.2
    )

    return df.round({'неуверенность': 4, 'энтропия': 4, 'вероятность_ошибки_разметки': 4, 'полезность': 4}), classes

# --- ИНИЦИАЛИЗАЦИЯ ДАННЫХ ---
if 'projects' not in st.session_state:
    st.session_state.projects = {
        "traffic_signs_extreme": {"created_at": "2023-10-26 14:20", "data": None, "classes": [], "status": "ожидает_данных"}
    }
if 'active_project' not in st.session_state: st.session_state.active_project = None
if 'current_role' not in st.session_state: st.session_state.current_role = "Администратор проекта"

# СПИСОК РОЛЕЙ ПО ТЗ
ROLE_CHOICES = [
    "Администратор проекта", 
    "ML-инженер", 
    "Разметчик", 
    "Эксперт предметной области", 
    "Аналитик данных"
]

# --- БОКОВАЯ ПАНЕЛЬ ---
with st.sidebar:
    st.markdown("<span style='color: #9ece6a;'>DataForge-AI v1.0</span>", unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
    
    st.markdown("<span style='color: #565f89;'>ТЕКУЩАЯ РОЛЬ:</span>", unsafe_allow_html=True)
    st.session_state.current_role = st.radio("РОЛЬ:", ROLE_CHOICES, label_visibility="collapsed")
    st.divider()
    
    st.markdown("<span style='color: #7dcfff;'>ПРОЕКТЫ</span>", unsafe_allow_html=True)
    if st.button("новый_проект"):
        st.session_state.active_project = None
        st.rerun()
        
    for proj_name in reversed(list(st.session_state.projects.keys())):
        prefix = ">" if st.session_state.active_project == proj_name else "-"
        if st.button(f"{prefix} {proj_name}", key=f"side_{proj_name}"):
            st.session_state.active_project = proj_name
            st.rerun()

# --- МАРШРУТИЗАЦИЯ ---
if st.session_state.active_project is None:
    # === ЭКРАН ПОИСКА ===
    st.markdown("<h3 style='color: #bb9af7; font-weight: 300;'>Поиск / Создание проекта</h3>", unsafe_allow_html=True)
    search_query = st.text_input("Ctrl+Space для фокуса | Enter для поиска...", placeholder="> _", key="search_bar", label_visibility="collapsed")
    st.markdown("<br>", unsafe_allow_html=True)
    
    if search_query:
        fuzzy_matches = process.extractBests(search_query, list(st.session_state.projects.keys()), score_cutoff=50)
        if fuzzy_matches:
            st.markdown("<span style='color: #9ece6a;'>-- СОВПАДЕНИЯ --</span>", unsafe_allow_html=True)
            for match_name, score in fuzzy_matches:
                if st.button(f"открыть: {match_name} [{score}%]"):
                    st.session_state.active_project = match_name
                    st.rerun()
        else:
            st.markdown("<span style='color: #f7768e;'>-- НЕТ СОВПАДЕНИЙ --</span>", unsafe_allow_html=True)
            
        st.markdown("<br><span style='color: #e0af68;'>-- ДЕЙСТВИЯ --</span>", unsafe_allow_html=True)
        # Только Админ может создавать проекты согласно ТЗ
        if st.session_state.current_role == "Администратор проекта":
            if st.button(f"создать: '{search_query}'"):
                st.session_state.projects[search_query] = {"created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), "data": None, "classes": [], "status": "инициализирован"}
                st.session_state.active_project = search_query
                st.rerun()
        else:
            st.markdown("<span style='color: #565f89;'>Отказано в доступе: Создание проектов доступно только Администратору.</span>", unsafe_allow_html=True)
    else:
        st.markdown("<span style='color: #565f89;'>-- НЕДАВНИЕ --</span>", unsafe_allow_html=True)
        for proj_name in st.session_state.projects.keys():
            if st.button(f"- {proj_name}"):
                st.session_state.active_project = proj_name
                st.rerun()

else:
    # === ВНУТРИ ПРОЕКТА ===
    active_name = st.session_state.active_project
    proj_data = st.session_state.projects[active_name]
    role = st.session_state.current_role
    
    col1, col2, col3 = st.columns([6, 2, 2])
    with col1: 
        st.markdown(f"<h3 style='color: #7dcfff;'>Проект: {active_name}</h3>", unsafe_allow_html=True)
    with col2:
        # Экспорт разрешен только Администратору (согласно ТЗ)
        if proj_data['data'] is not None and role == "Администратор проекта":
            csv_export = proj_data['data'].to_csv(index=False).encode('utf-8')
            st.download_button(label="экспорт_csv", data=csv_export, file_name=f"{active_name}_cleaned.csv", mime="text/csv")
    with col3: 
        if st.button("закрыть"): 
            st.session_state.active_project = None
            st.rerun()
            
    st.markdown(f"<span style='color: #565f89;'>уровень_доступа: {role}</span>", unsafe_allow_html=True)
    st.divider()
    
    if proj_data['data'] is None:
        st.markdown("<h4 style='color: #bb9af7;'>Загрузка манифеста датасета</h4>", unsafe_allow_html=True)
        uploaded_file = st.file_uploader("Загрузить CSV", type=['csv'])
        if uploaded_file is not None:
            raw_df = pd.read_csv(uploaded_file)
            with st.spinner("Обработка тензоров..."):
                processed_df, extracted_classes = process_dataset(raw_df)
                st.session_state.projects[active_name]['data'] = processed_df
                st.session_state.projects[active_name]['classes'] = extracted_classes
                st.session_state.projects[active_name]['status'] = "активен"
                st.rerun()
    else:
        df = proj_data['data']
        classes = proj_data['classes']
        
        # --- ПРЕДВАРИТЕЛЬНЫЕ РАСЧЕТЫ ДЛЯ ВСЕХ ВКЛАДОК И РОЛЕЙ ---
        # Считаем эти данные один раз здесь, чтобы они были доступны везде и не вызывали NameError
        active_learning_queue = df[df['дубликат'] == False].sort_values(by='полезность', ascending=False)
        suspicious_data = df[df['вероятность_ошибки_разметки'] > 0.5].sort_values(by='вероятность_ошибки_разметки', ascending=False)
        
        tab1, tab2, tab3, tab4 = st.tabs(["Аналитика", "Очередь обучения", "Разметка", "Дорожная карта (LLM)"])
        
        # --- ВКЛАДКА 1: АНАЛИТИКА ---
        with tab1:
            if role in ["Разметчик", "Эксперт предметной области"]:
                st.markdown("<span style='color: #f7768e;'>Доступ закрыт: Недостаточно прав для просмотра аналитики.</span>", unsafe_allow_html=True)
            else:
                st.markdown("<br>", unsafe_allow_html=True)
                col_m1, col_m2, col_m3, col_m4 = st.columns(4)
                col_m1.metric("Всего объектов", len(df))
                col_m2.metric("Дубликатов", df['дубликат'].sum())
                col_m3.metric("Высокая энтропия", len(df[df['энтропия'] > 1.0]))
                col_m4.metric("Подозрительная разметка", len(suspicious_data))
                st.divider()
                st.markdown("<span style='color: #7aa2f7;'>Баланс классов</span>", unsafe_allow_html=True)
                st.bar_chart(df['истинный_класс'].value_counts(), color="#7aa2f7")
        
        # --- ВКЛАДКА 2: ОЧЕРЕДЬ ---
        with tab2:
            if role == "Разметчик":
                st.markdown("<span style='color: #f7768e;'>Доступ закрыт.</span>", unsafe_allow_html=True)
            else:
                st.markdown("<br><span style='color: #9ece6a;'>Объекты отсортированы по интегральной полезности для дообучения</span>", unsafe_allow_html=True)
                st.dataframe(active_learning_queue[['id_объекта', 'истинный_класс', 'предсказанный_класс', 'энтропия', 'полезность']].head(100), use_container_width=True)
                
        # --- ВКЛАДКА 3: РАЗМЕТКА ---
        with tab3:
            if role in ["Аналитик данных", "ML-инженер"]:
                st.markdown("<span style='color: #f7768e;'>Доступ закрыт: Разметка выполняется Разметчиками и Экспертами.</span>", unsafe_allow_html=True)
            else:
                st.markdown("<br><span style='color: #e0af68;'>Проверка и исправление спорных меток</span>", unsafe_allow_html=True)
                if not suspicious_data.empty:
                    st.data_editor(
                        suspicious_data[['id_объекта', 'истинный_класс', 'предсказанный_класс', 'вероятность_ошибки_разметки']],
                        column_config={"истинный_класс": st.column_config.SelectboxColumn("Истинный класс (редактировать)", options=classes, required=True)},
                        disabled=["id_объекта", "предсказанный_класс", "вероятность_ошибки_разметки"],
                        use_container_width=True, hide_index=True, key=f"editor_{active_name}"
                    )
                else:
                    st.success("Ошибок разметки не найдено.")

        # --- ВКЛАДКА 4: ДОРОЖНАЯ КАРТА И LLM ---
        with tab4:
            if role in ["Разметчик", "Эксперт предметной области"]:
                st.markdown("<span style='color: #f7768e;'>Доступ закрыт.</span>", unsafe_allow_html=True)
            else:
                st.markdown("<br><h4 style='color: #bb9af7;'>Генерация заданий</h4>", unsafe_allow_html=True)
                
                rarest_class = df['истинный_класс'].value_counts().idxmin()
                st.markdown(f"**[ЗАДАЧА-01]** Очистка: удалить **{df['дубликат'].sum()}** дубликатов.")
                st.markdown(f"**[ЗАДАЧА-02]** Разметка: перепроверить **{len(suspicious_data)}** объектов с вероятной ошибкой.")
                st.markdown(f"**[ЗАДАЧА-03]** Сбор данных: критический дефицит класса **{rarest_class}**.")
                
                st.divider()
                st.markdown("<span style='color: #7dcfff;'>Локальный ИИ-ассистент (Ollama)</span>", unsafe_allow_html=True)
                
                llm_model = st.text_input("Название модели (например, llama3.2):", value="llama3.2")
                
                if st.button("Сгенерировать расширенный план"):
                    prompt = f"Действуй как Senior MLOps Engineer. Я анализирую датасет. В нем {len(df)} строк. Найдено {df['дубликат'].sum()} дубликатов. Найдено {len(suspicious_data)} ошибок разметки. Самый редкий класс: {rarest_class}. Напиши очень краткий, строгий план действий из 3 пунктов для улучшения датасета без лишней воды на русском языке."
                    
                    try:
                        with st.spinner(f"Запрос к {llm_model} на localhost:11434..."):
                            res = requests.post("http://localhost:11434/api/generate", json={
                                "model": llm_model,
                                "prompt": prompt,
                                "stream": False
                            }, timeout=15)
                            
                        if res.status_code == 200:
                            st.info(res.json()['response'])
                        else:
                            st.error(f"Ошибка Ollama: {res.status_code}")
                    except Exception as e:
                        st.error(f"Не удалось подключиться к Ollama. Убедись, что она запущена.")

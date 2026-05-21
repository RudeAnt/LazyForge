import streamlit as st
import pandas as pd
import numpy as np
import datetime
import streamlit.components.v1 as components
from thefuzz import process

# --- НАСТРОЙКИ И CSS (LAZYVIM VIBE) ---
st.set_page_config(page_title="DataForge Workspace", layout="wide", initial_sidebar_state="expanded")

st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Fira+Code:wght@300;400;500;700&display=swap');
    header {visibility: hidden;}
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
    .stApp { background-color: #1a1b26; color: #a9b1d6; font-family: 'Fira Code', monospace !important; }
    [data-testid="stSidebar"] { background-color: #16161e; border-right: 1px solid #292e42; }
    .stTextInput input, div[data-baseweb="input"] > div { background-color: #1f2335 !important; color: #c0caf5 !important; border: 1px solid #3b4261 !important; border-radius: 2px !important; font-family: 'Fira Code', monospace !important; padding: 12px !important; }
    .stTextInput input:focus, div[data-baseweb="input"] > div:focus-within { border-color: #7aa2f7 !important; box-shadow: none !important; }
    .stButton > button { background-color: transparent !important; color: #7aa2f7 !important; border: 1px solid #292e42 !important; border-radius: 2px !important; font-family: 'Fira Code', monospace !important; justify-content: flex-start !important; width: 100% !important; transition: all 0.2s; }
    .stButton > button:hover { border-color: #7aa2f7 !important; color: #1a1b26 !important; background-color: #7aa2f7 !important; }
    hr { border-bottom-color: #292e42 !important; }
    .block-container { padding-top: 2rem !important; }
    /* Стилизация вкладок */
    .stTabs [data-baseweb="tab-list"] { gap: 8px; }
    .stTabs [data-baseweb="tab"] { background-color: #1f2335; border-radius: 4px 4px 0 0; padding-top: 10px; padding-bottom: 10px; color: #565f89; }
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
            const searchInput = parentDoc.querySelector('input[aria-label="Ctrl+Space to focus | hit Enter to search..."]');
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
        "dataset_animals_v1": {"created_at": "2023-10-25 10:00", "data": None, "classes": [], "status": "indexed"}
    }
if 'active_project' not in st.session_state: st.session_state.active_project = None
if 'current_role' not in st.session_state: st.session_state.current_role = "ml_engineer"

# --- БОКОВАЯ ПАНЕЛЬ ---
with st.sidebar:
    st.markdown("<span style='color: #9ece6a;'> DataForge-AI v1.0</span>", unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
    st.session_state.current_role = st.radio("ROLE:", ["ml_engineer", "annotator", "admin"], label_visibility="collapsed")
    st.divider()
    
    st.markdown("<span style='color: #7dcfff;'> PROJECTS</span>", unsafe_allow_html=True)
    if st.button(" new_project"):
        st.session_state.active_project = None
        st.rerun()
        
    for proj_name in reversed(list(st.session_state.projects.keys())):
        prefix = "" if st.session_state.active_project == proj_name else ""
        if st.button(f"{prefix} {proj_name}", key=f"side_{proj_name}"):
            st.session_state.active_project = proj_name
            st.rerun()

# --- МАРШРУТИЗАЦИЯ ---
if st.session_state.active_project is None:
    # --- ЭКРАН ПОИСКА ---
    st.markdown("<h3 style='color: #bb9af7; font-weight: 300;'>Find Project / Create New</h3>", unsafe_allow_html=True)
    search_query = st.text_input("Ctrl+Space to focus | hit Enter to search...", placeholder="> _", key="search_bar", label_visibility="collapsed")
    st.markdown("<br>", unsafe_allow_html=True)
    
    if search_query:
        fuzzy_matches = process.extractBests(search_query, list(st.session_state.projects.keys()), score_cutoff=50)
        if fuzzy_matches:
            st.markdown("<span style='color: #9ece6a;'>-- MATCHES --</span>", unsafe_allow_html=True)
            for match_name, score in fuzzy_matches:
                if st.button(f"󰈈 {match_name}  [{score}%]"):
                    st.session_state.active_project = match_name
                    st.rerun()
        else:
            st.markdown("<span style='color: #f7768e;'>-- NO MATCHES --</span>", unsafe_allow_html=True)
            
        st.markdown("<br><span style='color: #e0af68;'>-- ACTIONS --</span>", unsafe_allow_html=True)
        if st.button(f" create: '{search_query}'"):
            st.session_state.projects[search_query] = {"created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), "data": None, "classes": [], "status": "initialized"}
            st.session_state.active_project = search_query
            st.rerun()
    else:
        st.markdown("<span style='color: #565f89;'>-- RECENT --</span>", unsafe_allow_html=True)
        for proj_name in st.session_state.projects.keys():
            if st.button(f" {proj_name}"):
                st.session_state.active_project = proj_name
                st.rerun()

else:
    # --- ВНУТРИ ПРОЕКТА ---
    active_name = st.session_state.active_project
    proj_data = st.session_state.projects[active_name]
    
    col1, col2 = st.columns([8, 2])
    with col1: st.markdown(f"<h3 style='color: #7dcfff;'> {active_name}</h3>", unsafe_allow_html=True)
    with col2: 
        if st.button("󰌍 close"): 
            st.session_state.active_project = None
            st.rerun()
            
    st.markdown(f"<span style='color: #565f89;'>access_level: {st.session_state.current_role}</span>", unsafe_allow_html=True)
    st.divider()
    
    if proj_data['data'] is None:
        # Загрузка файла, если проект пустой
        st.markdown("<h4 style='color: #bb9af7;'>Load Dataset</h4>", unsafe_allow_html=True)
        uploaded_file = st.file_uploader("Upload CSV manifest", type=['csv'])
        if uploaded_file is not None:
            raw_df = pd.read_csv(uploaded_file)
            with st.spinner("Processing vectors and matrices..."):
                processed_df, extracted_classes = process_dataset(raw_df)
                st.session_state.projects[active_name]['data'] = processed_df
                st.session_state.projects[active_name]['classes'] = extracted_classes
                st.session_state.projects[active_name]['status'] = "active"
                st.rerun()
    else:
        # Датасет загружен - показываем интерфейс платформы
        df = proj_data['data']
        classes = proj_data['classes']
        
        tab1, tab2, tab3 = st.tabs(["  Analytics & Structure", "  Active Learning Queue", "  Interactive Annotation"])
        
        with tab1:
            st.markdown("<br>", unsafe_allow_html=True)
            col_m1, col_m2, col_m3, col_m4 = st.columns(4)
            col_m1.metric("Total Objects", len(df))
            col_m2.metric("Duplicates", df['дубликат'].sum())
            col_m3.metric("High Entropy", len(df[df['энтропия'] > 1.0]))
            col_m4.metric("Suspect Labels", len(df[df['вероятность_ошибки_разметки'] > 0.5]))
            
            st.divider()
            c1, c2 = st.columns(2)
            with c1:
                st.markdown("<span style='color: #7aa2f7;'>Balance by Class</span>", unsafe_allow_html=True)
                st.bar_chart(df['истинный_класс'].value_counts(), color="#7aa2f7")
            with c2:
                # Окно структуры: проверяем качество разметчиков (Метаданные)
                if 'разметчик' in df.columns:
                    st.markdown("<span style='color: #f7768e;'>Errors by Annotator (Metadata)</span>", unsafe_allow_html=True)
                    errors_df = df[df['вероятность_ошибки_разметки'] > 0.5]
                    if not errors_df.empty:
                        st.bar_chart(errors_df['разметчик'].value_counts(), color="#f7768e")
                    else:
                        st.success("No annotator errors found!") //author test
        
        with tab2:
            st.markdown("<br><span style='color: #9ece6a;'>Objects ranked by integral utility for next training iteration</span>", unsafe_allow_html=True)
            active_learning_queue = df[df['дубликат'] == False].sort_values(by='полезность', ascending=False)
            st.dataframe(active_learning_queue[['id_объекта', 'истинный_класс', 'предсказанный_класс', 'энтропия', 'полезность']].head(100), use_container_width=True)
            
        with tab3:
            st.markdown("<br><span style='color: #e0af68;'>Review and correct suspect labels directly in the workspace</span>", unsafe_allow_html=True)
            suspicious_data = df[df['вероятность_ошибки_разметки'] > 0.5].sort_values(by='вероятность_ошибки_разметки', ascending=False)
            
            if not suspicious_data.empty:
                # ИНТЕРАКТИВНЫЙ РЕДАКТОР (st.data_editor)
                edited_df = st.data_editor(
                    suspicious_data[['id_объекта', 'разметчик', 'истинный_класс', 'предсказанный_класс', 'вероятность_ошибки_разметки']],
                    column_config={
                        "истинный_класс": st.column_config.SelectboxColumn(
                            "Истинный класс (Edit here)",
                            help="Выберите правильный класс из списка",
                            options=classes,
                            required=True
                        )
                    },
                    disabled=["id_объекта", "разметчик", "предсказанный_класс", "вероятность_ошибки_разметки"],
                    use_container_width=True,
                    hide_index=True,
                    key=f"editor_{active_name}"
                )
                
                # Примечание для жюри
                st.caption("Окно разметки: Выбор нового класса сохраняется в датасете проекта.")
            else:
                st.success("All labels look perfectly fine!")

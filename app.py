import streamlit as st
import pandas as pd
import numpy as np
import datetime
import requests
import streamlit.components.v1 as components
from thefuzz import process

# Подключаем вынесенную логику
import business_logic as bl
from math_engine import get_dataset_metrics

# --- НАСТРОЙКИ И CSS ---
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

# --- ИНИЦИАЛИЗАЦИЯ ДАННЫХ ---
if 'projects' not in st.session_state:
    st.session_state.projects = {}
if 'active_project' not in st.session_state: st.session_state.active_project = None
if 'current_role' not in st.session_state: st.session_state.current_role = "Администратор проекта"

ROLE_CHOICES = ["Администратор проекта", "ML-инженер", "Разметчик", "Эксперт предметной области", "Аналитик данных"]

# --- БОКОВАЯ ПАНЕЛЬ ---
with st.sidebar:
    st.markdown("<span style='color: #9ece6a;'>DataForge-AI v1.2</span>", unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
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
        if st.session_state.current_role == "Администратор проекта":
            if st.button(f"создать: '{search_query}'"):
                st.session_state.projects[search_query] = {"created_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"), "data": None, "classes": [], "versions": []}
                st.session_state.active_project = search_query
                st.rerun()
        else:
            st.markdown("<span style='color: #565f89;'>Отказано: Создание проектов доступно Администратору.</span>", unsafe_allow_html=True)
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
    with col1: st.markdown(f"<h3 style='color: #7dcfff;'>Проект: {active_name}</h3>", unsafe_allow_html=True)
    with col2:
        if proj_data['data'] is not None and role == "Администратор проекта":
            csv_export = proj_data['data'].to_csv(index=False).encode('utf-8')
            st.download_button("экспорт_csv", data=csv_export, file_name=f"{active_name}.csv", mime="text/csv")
    with col3: 
        if st.button("x закрыть"): 
            st.session_state.active_project = None
            st.rerun()
            
    st.markdown(f"<span style='color: #565f89;'>допуск: {role}</span>", unsafe_allow_html=True)
    st.divider()
    
    if proj_data['data'] is None:
        st.markdown("<h4 style='color: #bb9af7;'>Инициализация датасета</h4>", unsafe_allow_html=True)
        uploaded_file = st.file_uploader("Загрузить первичный CSV", type=['csv'])
        if uploaded_file is not None:
            raw_df = pd.read_csv(uploaded_file)
            with st.spinner("Сборка тензоров..."):
                # ИСПОЛЬЗУЕМ ВЫНЕСЕННУЮ БИЗНЕС-ЛОГИКУ
                processed_df, extracted_classes = bl.initial_process_dataset(raw_df)
                final_df = bl.recalculate_dynamic_metrics(processed_df, extracted_classes)
                
                st.session_state.projects[active_name]['data'] = final_df
                st.session_state.projects[active_name]['classes'] = extracted_classes
                _, readiness_lvl = get_dataset_metrics(final_df, extracted_classes)
                st.session_state.projects[active_name]['versions'].append({"name": f"v1_init", "data": final_df.copy(), "readiness": readiness_lvl})
                st.rerun()
    else:
        df = proj_data['data']
        classes = proj_data['classes']
        
        imbalance_idx, readiness_lvl = get_dataset_metrics(df, classes)
        active_learning_queue = df[df['дубликат'] == False].sort_values(by='полезность', ascending=False)
        suspicious_data = df[df['вероятность_ошибки_разметки'] > 0.5].sort_values(by='вероятность_ошибки_разметки', ascending=False)
        
        tab1, tab2, tab3, tab4, tab5 = st.tabs(["Аналитика", "Очередь (Карточка объекта)", "Разметка", "База и Версии", "LLM Roadmap"])
        
        # --- ВКЛАДКА 1: АНАЛИТИКА ---
        with tab1:
            if role in ["Разметчик", "Эксперт предметной области"]:
                st.markdown("<span style='color: #f7768e;'>Доступ закрыт.</span>", unsafe_allow_html=True)
            else:
                st.markdown("<br>", unsafe_allow_html=True)
                col_m1, col_m2, col_m3, col_m4 = st.columns(4)
                col_m1.metric("Всего объектов", len(df))
                col_m2.metric("Уровень готовности", f"{readiness_lvl}%")
                col_m3.metric("Индекс дисбаланса", imbalance_idx)
                col_m4.metric("Потенциальных ошибок", len(suspicious_data))
                st.divider()
                st.bar_chart(df['истинный_класс'].value_counts(), color="#7aa2f7")
        
        # --- ВКЛАДКА 2: ОЧЕРЕДЬ И КАРТОЧКА ОБЪЕКТА ---
        with tab2:
            if role == "Разметчик":
                st.markdown("<span style='color: #f7768e;'>Доступ закрыт.</span>", unsafe_allow_html=True)
            else:
                st.markdown("<br><span style='color: #9ece6a;'>Детальная карточка объекта</span>", unsafe_allow_html=True)
                obj_id = st.text_input("Введите id_объекта (например: extreme_00000.jpg):")
                if obj_id:
                    obj_row = df[df['id_объекта'] == obj_id]
                    if not obj_row.empty:
                        row_data = obj_row.iloc[0]
                        st.markdown(f"### Данные по объекту: `{row_data['id_объекта']}`")
                        
                        col_i1, col_i2 = st.columns(2)
                        with col_i1:
                            st.markdown(f"**Разметчик (Текущая метка):** `{row_data['истинный_класс']}`")
                        with col_i2:
                            st.markdown(f"**Предсказание нейросети:** `{row_data['предсказанный_класс']}`")
                        
                        st.divider()
                        
                        col_m1, col_m2, col_m3, col_m4 = st.columns(4)
                        col_m1.metric("Уверенность", row_data['уверенность'])
                        col_m2.metric("Энтропия", row_data['энтропия'])
                        col_m3.metric("Вер. ошибки", row_data['вероятность_ошибки_разметки'])
                        col_m4.metric("Полезность (AL)", row_data['полезность'])
                        
                        st.markdown("<br><b>Распределение вероятностей по классам:</b>", unsafe_allow_html=True)
                        prob_cols = [c for c in df.columns if c.startswith('prob_')]
                        probs_dict = {col.replace('prob_', ''): row_data[col] for col in prob_cols}
                        st.bar_chart(pd.Series(probs_dict), color="#bb9af7")
                        
                        rec, reason = "Оставить в базе", "Нормальные показатели"
                        if row_data['дубликат']: rec, reason = "Удалить", "Обнаружен дубликат"
                        elif row_data['вероятность_ошибки_разметки'] > 0.5: rec, reason = "Переразметить", "Конфликт разметки и модели"
                        elif row_data['norm_entropy'] > 0.6: rec, reason = "Экспертиза", "Высокая неопределенность (Хаос предсказаний)"
                            
                        st.info(f"**Причина попадания в очередь:** {reason} \n\n **Рекомендация:** {rec}")
                    else:
                        st.warning("Объект не найден.")
                
                st.divider()
                st.markdown("<span style='color: #9ece6a;'>Топ объектов для дообучения</span>", unsafe_allow_html=True)
                st.dataframe(active_learning_queue[['id_объекта', 'истинный_класс', 'предсказанный_класс', 'полезность', 'энтропия', 'уверенность']], use_container_width=True)
                
        # --- ВКЛАДКА 3: ДИНАМИЧЕСКАЯ РАЗМЕТКА ---
        with tab3:
            if role in ["Аналитик данных", "ML-инженер"]:
                st.markdown("<span style='color: #f7768e;'>Доступ закрыт. Разметку ведут Разметчики и Эксперты.</span>", unsafe_allow_html=True)
            else:
                st.markdown("<br><span style='color: #e0af68;'>Интерактивный редактор сложных случаев</span>", unsafe_allow_html=True)
                edit_subset = df[(df['вероятность_ошибки_разметки'] > 0.5) | (df['нужен_эксперт'] == True)]
                
                if not edit_subset.empty:
                    edited_slice = st.data_editor(
                        edit_subset[['id_объекта', 'истинный_класс', 'предсказанный_класс', 'вероятность_ошибки_разметки', 'комментарий', 'нужен_эксперт']],
                        column_config={
                            "истинный_класс": st.column_config.SelectboxColumn("Истинный класс", options=classes, required=True),
                            "предсказанный_класс": "Предсказание сети",
                            "комментарий": st.column_config.TextColumn("Комментарий"),
                            "нужен_эксперт": st.column_config.CheckboxColumn("В эскалацию")
                        },
                        disabled=["id_объекта", "предсказанный_класс", "вероятность_ошибки_разметки"] if role == "Разметчик" else ["id_объекта", "предсказанный_класс"],
                        use_container_width=True, hide_index=True, key=f"editor_{active_name}"
                    )
                    
                    changed = False
                    for idx in edited_slice.index:
                        if (edited_slice.loc[idx, 'истинный_класс'] != edit_subset.loc[idx, 'истинный_класс'] or 
                            edited_slice.loc[idx, 'комментарий'] != edit_subset.loc[idx, 'комментарий'] or 
                            edited_slice.loc[idx, 'нужен_эксперт'] != edit_subset.loc[idx, 'нужен_эксперт']):
                            
                            df.loc[idx, 'истинный_класс'] = edited_slice.loc[idx, 'истинный_класс']
                            df.loc[idx, 'комментарий'] = edited_slice.loc[idx, 'комментарий']
                            df.loc[idx, 'нужен_эксперт'] = edited_slice.loc[idx, 'нужен_эксперт']
                            changed = True
                            
                    if changed:
                        # ИСПОЛЬЗУЕМ ВЫНЕСЕННУЮ БИЗНЕС-ЛОГИКУ
                        df = bl.recalculate_dynamic_metrics(df, classes)
                        st.session_state.projects[active_name]['data'] = df
                        st.rerun() 
                else:
                    st.success("Ошибок нет. Датасет чист.")

        # --- ВКЛАДКА 4: БАЗА И ВЕРСИИ ---
        with tab4:
            st.markdown("<br><span style='color: #7dcfff;'>Система управления версиями данных (DVC)</span>", unsafe_allow_html=True)
            
            if role == "Администратор проекта":
                with st.expander("Добавить новые данные (Загрузка нового CSV)"):
                    new_file = st.file_uploader("Загрузить файл для обогащения датасета", type=['csv'], key="new_csv")
                    if new_file is not None:
                        ver_name = f"v_before_merge_{datetime.datetime.now().strftime('%H:%M:%S')}"
                        st.session_state.projects[active_name]['versions'].append({"name": ver_name, "data": df.copy(), "readiness": readiness_lvl})
                        
                        raw_df = pd.read_csv(new_file)
                        processed_df, ext_classes = bl.initial_process_dataset(raw_df)
                        final_df = bl.recalculate_dynamic_metrics(processed_df, ext_classes)
                        
                        st.session_state.projects[active_name]['data'] = final_df
                        st.session_state.projects[active_name]['classes'] = ext_classes
                        st.rerun()
            
            display_df = df.copy()
            display_df['Статус'] = display_df.apply(bl.assign_status, axis=1)
            st.dataframe(display_df[['id_объекта', 'Статус', 'истинный_класс', 'предсказанный_класс', 'уверенность', 'энтропия', 'комментарий']], use_container_width=True)
            
            st.divider()
            st.markdown("#### История коммитов (Откат версий)")
            if proj_data['versions']:
                ver_names = [v['name'] for v in proj_data['versions']]
                selected_ver = st.selectbox("Выберите версию для возврата:", ver_names)
                if st.button("Откатить датасет к выбранной версии"):
                    for v in proj_data['versions']:
                        if v['name'] == selected_ver:
                            backup_name = f"backup_{datetime.datetime.now().strftime('%H:%M:%S')}"
                            st.session_state.projects[active_name]['versions'].append({"name": backup_name, "data": df.copy(), "readiness": readiness_lvl})
                            st.session_state.projects[active_name]['data'] = v['data'].copy()
                            st.rerun()
            else:
                st.info("Нет сохраненных версий.")
                
            if st.button("Создать коммит (Сохранить текущую версию)"):
                new_ver = f"commit_{datetime.datetime.now().strftime('%H:%M:%S')}"
                st.session_state.projects[active_name]['versions'].append({"name": new_ver, "data": df.copy(), "readiness": readiness_lvl})
                st.success(f"Версия {new_ver} сохранена!")
                st.rerun()

        # --- ВКЛАДКА 5: LLM ---
        with tab5:
            if role in ["Разметчик", "Эксперт предметной области"]:
                st.markdown("<span style='color: #f7768e;'>Доступ закрыт.</span>", unsafe_allow_html=True)
            else:
                st.markdown("<br><h4 style='color: #bb9af7;'>Генерация заданий</h4>", unsafe_allow_html=True)
                st.markdown(f"**[ЗАДАЧА-01]** Очистка: удалить **{df['дубликат'].sum()}** дубликатов.")
                st.markdown(f"**[ЗАДАЧА-02]** Разметка: перепроверить **{len(suspicious_data)}** конфликтов.")
                
                llm_model = st.text_input("Название модели Ollama (например, llama3.2):", value="llama3.2")
                if st.button("Сгенерировать план"):
                    prompt = f"Действуй как MLOps Engineer. Датасет: {len(df)} строк. Дубликатов: {df['дубликат'].sum()}. Ошибок разметки: {len(suspicious_data)}. Уровень готовности: {readiness_lvl}%. Напиши краткий план из 3 пунктов для улучшения."
                    try:
                        res = requests.post("http://localhost:11434/api/generate", json={"model": llm_model, "prompt": prompt, "stream": False}, timeout=15)
                        st.info(res.json()['response']) if res.status_code == 200 else st.error("Ошибка API")
                    except:
                        st.error("Нет подключения к Ollama.")

import streamlit as st
import pandas as pd
import numpy as np

# --- Настройки страницы ---
st.set_page_config(page_title="DataForge AI", layout="wide", page_icon="🛡️")

# --- Боковое меню ---
with st.sidebar:
    st.header("Настройки системы")
    role = st.selectbox("Войти как:", ["ML-инженер", "Разметчик", "Администратор"])
    st.divider()
    st.markdown("**DataForge AI** v1.0")

st.title("🛡️ DataForge AI: Интеллектуальный анализ датасетов")
st.write("Загрузите сырые предсказания модели для вероятностной оценки качества датасета.")

# --- ЯДРО СИСТЕМЫ: Функция обработки данных ---
@st.cache_data
def process_dataset(df):
    """
    Эта функция берет сырой датасет и на лету считает всю математику:
    энтропию, неуверенность, ошибки разметки и интегральную полезность.
    """
    # 1. Автоматически находим колонки с вероятностями (начинаются на 'prob_')
    prob_cols = [col for col in df.columns if col.startswith('prob_')]
    classes = [col.replace('prob_', '') for col in prob_cols]
    
    # Принудительно конвертируем в числа (защита от багов с пробелами, как у нас было)
    df[prob_cols] = df[prob_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
    probs = df[prob_cols].values

    # 2. Неуверенность и Энтропия
    max_probs = np.max(probs, axis=1)
    df['неуверенность'] = 1.0 - max_probs
    df['энтропия'] = -np.sum(probs * np.log2(probs + 1e-9), axis=1)

    # 3. Ошибки разметки
    predicted_idx = np.argmax(probs, axis=1)
    df['предсказанный_класс'] = [classes[i] for i in predicted_idx]
    
    df['вероятность_ошибки_разметки'] = np.where(
        df['истинный_класс'] != df['предсказанный_класс'],
        1.0 - df['неуверенность'], 
        0.0
    )

    # 4. Поиск дубликатов
    df['дубликат'] = df.duplicated(subset=prob_cols + ['истинный_класс'], keep=False)

    # 5. Дефицит классов
    class_counts = df['истинный_класс'].value_counts()
    total_objects = len(df)
    ideal_share = 1.0 / len(classes)

    def calc_deficit(c_name):
        # Если класс вообще не найден, ставим максимальный дефицит
        if c_name not in class_counts: return 10.0 
        real_share = class_counts[c_name] / total_objects
        return ideal_share / real_share

    df['дефицит_класса'] = df['истинный_класс'].apply(calc_deficit)

    # 6. Интегральная полезность
    norm_entropy = df['энтропия'] / np.log2(len(classes) + 1e-9)
    df['полезность'] = np.where(
        df['дубликат'], 
        0.0, 
        norm_entropy * 0.4 + df['вероятность_ошибки_разметки'] * 0.4 + df['дефицит_класса'] * 0.2
    )

    # Округляем всё для красоты
    df = df.round({'неуверенность': 4, 'энтропия': 4, 'вероятность_ошибки_разметки': 4, 'полезность': 4})
    return df

# --- ОКНО ЗАГРУЗКИ ДАННЫХ ---
uploaded_file = st.file_uploader("📂 Загрузите ваш сырой датасет (CSV формат)", type=['csv'])

if uploaded_file is not None:
    # Читаем загруженный файл
    raw_df = pd.read_csv(uploaded_file)
    
    with st.spinner("Проводим вероятностный анализ данных..."):
        # Прогоняем через наше математическое ядро
        df = process_dataset(raw_df)
    
    st.success("✅ Анализ успешно завершен!")
    
    # --- ВКЛАДКИ ИНТЕРФЕЙСА ---
    tab1, tab2, tab3 = st.tabs(["📊 Аналитика", "🔥 Очередь активного обучения", "🔍 Поиск сложных случаев"])

    # === ВКЛАДКА 1: Дашборд ===
    with tab1:
        st.subheader("Общая статистика проекта")
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Всего объектов", len(df))
        col2.metric("Найдено дубликатов", df['дубликат'].sum())
        col3.metric("Спорных объектов", len(df[df['энтропия'] > 1.0]))
        col4.metric("Подозрительная разметка", len(df[df['вероятность_ошибки_разметки'] > 0.5]))

        st.divider()

        col_chart1, col_chart2 = st.columns(2)
        with col_chart1:
            st.subheader("⚖️ Баланс классов (Распределение)")
            st.bar_chart(df['истинный_класс'].value_counts())
            
        with col_chart2:
            st.subheader("🌡️ Средняя энтропия по классам")
            st.bar_chart(df.groupby('истинный_класс')['энтропия'].mean(), color="#ff4b4b")

    # === ВКЛАДКА 2: Очередь ===
    with tab2:
        st.subheader("Топ объектов для дообучения")
        active_learning_queue = df[df['дубликат'] == False].sort_values(by='полезность', ascending=False)
        display_cols = ['id_объекта', 'истинный_класс', 'предсказанный_класс', 'энтропия', 'вероятность_ошибки_разметки', 'полезность']
        st.dataframe(active_learning_queue[display_cols].head(100), use_container_width=True)

    # === ВКЛАДКА 3: Ошибки ===
    with tab3:
        st.subheader("Объекты с высокой вероятностью ошибки разметки")
        suspicious_data = df[df['вероятность_ошибки_разметки'] > 0.5].sort_values(by='вероятность_ошибки_разметки', ascending=False)
        
        if not suspicious_data.empty:
             display_cols_suspicious = ['id_объекта', 'разметчик', 'истинный_класс', 'предсказанный_класс', 'вероятность_ошибки_разметки']
             st.dataframe(suspicious_data[display_cols_suspicious], use_container_width=True)
        else:
             st.success("Разметчики отработали идеально!")
else:
    st.info("👆 Загрузите CSV файл, чтобы начать работу. Файл должен содержать колонки 'истинный_класс' и 'prob_[имя_класса]'.")

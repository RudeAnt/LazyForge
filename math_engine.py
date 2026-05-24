import pandas as pd
import numpy as np

def calculate_base_metrics(df: pd.DataFrame, classes: list) -> pd.DataFrame:
    df = df.copy()
    prob_cols = [col for col in df.columns if col.startswith('prob_')]
    
    df[prob_cols] = df[prob_cols].apply(pd.to_numeric, errors='coerce').fillna(0)
    probs = df[prob_cols].values

    df['уверенность'] = np.max(probs, axis=1)
    df['неуверенность'] = 1.0 - df['уверенность']
    
    max_entropy = np.log2(len(classes) + 1e-9)
    df['энтропия'] = -np.sum(probs * np.log2(probs + 1e-9), axis=1)
    df['norm_entropy'] = df['энтропия'] / max_entropy
    df['новизна'] = df['неуверенность'] * df['norm_entropy']

    predicted_idx = np.argmax(probs, axis=1)
    df['предсказанный_класс'] = [classes[i] for i in predicted_idx]
    df['дубликат'] = df.duplicated(subset=prob_cols + ['истинный_класс'], keep=False)
    
    return df

def calculate_bayesian_error(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    
    # Имитация исторического доверия, если нет реальных данных
    if 'автор_разметки' not in df.columns:
        df['автор_разметки'] = np.random.choice(["expert", "junior"], size=len(df))

    # Для эксперта ошибка 5%, для джуна 30%
    df['вероятность_ошибки_человека'] = np.where(df['автор_разметки'] == 'expert', 0.05, 0.30)
    
    mismatch_mask = df['истинный_класс'] != df['предсказанный_класс']
    
    # Чтобы интерфейс (порог > 0.5) ловил ошибки, мы масштабируем результат:
    # Базовая логика была: 1.0 - неуверенность (то есть уверенность). 
    # Теперь мы добавляем вес Байеса, но держим значение высоким при конфликте.
    df['вероятность_ошибки_разметки'] = np.where(
        mismatch_mask,
        df['уверенность'] * (1 + df['вероятность_ошибки_человека']), # Усиливаем вес ошибки
        (1.0 - df['уверенность']) * df['вероятность_ошибки_человека'] * 0.5 
    )
    
    df['вероятность_ошибки_разметки'] = np.clip(df['вероятность_ошибки_разметки'], 0.0, 1.0)
    return df

def calculate_class_deficit(df: pd.DataFrame, classes: list) -> pd.DataFrame:
    df = df.copy()
    class_counts = df['истинный_класс'].value_counts()
    total_objects = len(df)
    ideal_share = 1.0 / len(classes)

    def calc_deficit(c_name):
        if c_name not in class_counts: return 10.0 
        return ideal_share / (class_counts[c_name] / total_objects)

    df['дефицит_класса'] = df['истинный_класс'].apply(calc_deficit)
    return df

def calculate_utility(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df['полезность'] = np.where(
        df['дубликат'], 0.0,  
        df['norm_entropy'] * 0.3 + df['вероятность_ошибки_разметки'] * 0.3 + df['дефицит_класса'] * 0.2 + df['новизна'] * 0.2
    )
    return df.round({'уверенность': 4, 'неуверенность': 4, 'энтропия': 4, 'вероятность_ошибки_разметки': 4, 'полезность': 4, 'новизна': 4})

def get_dataset_metrics(df: pd.DataFrame, classes: list) -> tuple:
    total = len(df)
    if total == 0: return 0, 0
    dupes = df['дубликат'].sum()
    errors = len(df[df['вероятность_ошибки_разметки'] > 0.5])
    
    shares = df['истинный_класс'].value_counts(normalize=True)
    imbalance_index = np.std(shares) * len(classes)
    
    readiness = max(0.0, 100.0 - (dupes / total * 100) - (errors / total * 100) - (imbalance_index * 15))
    return round(imbalance_index, 4), round(readiness, 1)

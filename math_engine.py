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

    predicted_idx = np.argmax(probs, axis=1)
    df['предсказанный_класс'] = [classes[i] for i in predicted_idx]
    df['дубликат'] = df.duplicated(subset=prob_cols + ['истинный_класс'], keep=False)
    
    return df

def calculate_novelty(df: pd.DataFrame, classes: list) -> pd.DataFrame:
    """
    ШАГ 2: Расчет новизны объекта (OOD-скор).
    Вычисляет косинусное расстояние от объекта до центроида (типичного представителя) его предсказанного класса.
    """
    df = df.copy()
    
    # В проде векторы берутся из модели. Для MVP симулируем скрытое пространство (эмбеддинги)
    if 'emb_0' not in df.columns:
        np.random.seed(42) # Для стабильности результатов
        embeddings = np.random.rand(len(df), 16)
    else:
        emb_cols = [c for c in df.columns if c.startswith('emb_')]
        embeddings = df[emb_cols].values

    centroids = {}
    pred_classes = df['предсказанный_класс'].values
    confidences = df['уверенность'].values

    for cls in classes:
        # Центроид — это средний вектор объектов, в которых модель уверена (>0.7)
        mask = (pred_classes == cls) & (confidences > 0.7)
        if mask.sum() > 0:
            centroids[cls] = np.mean(embeddings[mask], axis=0)
        else:
            centroids[cls] = np.mean(embeddings, axis=0) # Фолбэк, если уверенных нет

    novelty_scores = []
    for i in range(len(df)):
        vec = embeddings[i]
        cent = centroids[pred_classes[i]]
        
        # Косинусное расстояние: 1 - Cosine Similarity
        dot = np.dot(vec, cent)
        norm_vec = np.linalg.norm(vec)
        norm_cent = np.linalg.norm(cent)
        
        if norm_vec == 0 or norm_cent == 0:
            dist = 1.0
        else:
            sim = dot / (norm_vec * norm_cent)
            dist = 1.0 - sim
            
        novelty_scores.append(dist)

    # Нормализуем дистанцию от 0 до 1, чтобы она адекватно легла в формулу полезности
    max_dist = max(novelty_scores) if max(novelty_scores) > 0 else 1.0
    df['новизна'] = np.array(novelty_scores) / max_dist
    
    return df

def calculate_bayesian_error(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    
    # Ищем колонку с автором разметки. В новом датасете она называется 'разметчик'
    author_col = 'разметчик' if 'разметчик' in df.columns else 'автор_разметки'
    
    if author_col not in df.columns:
        df[author_col] = np.random.choice(["AutoLabel", "Intern_Vasya"], size=len(df))

    # Раздаем историческую вероятность ошибки для реальных разметчиков из датасета
    # Допустим, Вася косячит в 40% случаев, а AutoLabel ошибается в 10%
    df['вероятность_ошибки_человека'] = np.where(df[author_col] == 'Intern_Vasya', 0.40, 0.10)
    
    mismatch_mask = df['истинный_класс'] != df['предсказанный_класс']
    
    # Байесовский пересчет
    df['вероятность_ошибки_разметки'] = np.where(
        mismatch_mask,
        df['уверенность'] * (1 + df['вероятность_ошибки_человека']),
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

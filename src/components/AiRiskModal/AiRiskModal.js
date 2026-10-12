import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAnalyzeRisks, selectGroups } from '../../redux/slices/groups';
import MyModal from '../ui/modal/MyModal';
import {
    FaShieldAlt,
    FaExclamationTriangle,
    FaLightbulb,
    FaSyncAlt,
    FaTimes,
    FaRobot,
} from 'react-icons/fa';
import styles from './AiRiskModal.module.css';

const AiRiskModal = ({ visible, setVisible, groupId, groupTitle }) => {
    const dispatch = useDispatch();
    const { riskAnalysis } = useSelector(selectGroups);
    const cachedAnalysis = riskAnalysis?.[groupId];

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [analysis, setAnalysis] = useState(cachedAnalysis || null);

    const loadAnalysis = useCallback(async () => {
        if (!groupId) return;
        setIsLoading(true);
        setError('');
        try {
            const result = await dispatch(fetchAnalyzeRisks({ groupId })).unwrap();
            setAnalysis(result.analysis);
        } catch (err) {
            setError(err?.message || 'Не вдалося виконати аналіз ризиків');
        } finally {
            setIsLoading(false);
        }
    }, [dispatch, groupId]);

    useEffect(() => {
        if (visible) {
            if (cachedAnalysis) {
                setAnalysis(cachedAnalysis);
            } else {
                loadAnalysis();
            }
        }
    }, [visible, cachedAnalysis, loadAnalysis]);

    const getRiskBadge = (level) => {
        switch (level) {
            case 'CRITICAL':
                return <span className={`${styles.badge} ${styles.badgeCritical}`}>🔴 Критичний ризик</span>;
            case 'HIGH':
                return <span className={`${styles.badge} ${styles.badgeHigh}`}>🔴 Високий ризик</span>;
            case 'MEDIUM':
                return <span className={`${styles.badge} ${styles.badgeMedium}`}>🟡 Помірний ризик</span>;
            case 'LOW':
            default:
                return <span className={`${styles.badge} ${styles.badgeLow}`}>🟢 Низький ризик</span>;
        }
    };

    return (
        <MyModal visible={visible} setVisible={setVisible} contentClassName={styles.customModalContent}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <FaShieldAlt className={styles.headerIcon} />
                        <div>
                            <h2 className={styles.title}>AI-аналіз ризиків</h2>
                            <p className={styles.projectSubtitle}>{groupTitle || 'Проєкт'}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setVisible(false)}
                        className={styles.closeButton}
                        aria-label="Закрити"
                    >
                        <FaTimes />
                    </button>
                </div>

                {isLoading && (
                    <div className={styles.loadingContainer}>
                        <FaRobot className={styles.robotSpinner} />
                        <p className={styles.loadingText}>
                            ШІ аналізує задачі проєкту, оцінки тривалості, ймовірності дедлайнів та розподіл навантаження...
                        </p>
                    </div>
                )}

                {error && !isLoading && (
                    <div className={styles.errorContainer}>
                        <p>{error}</p>
                        <button
                            type="button"
                            className={styles.refreshButton}
                            onClick={loadAnalysis}
                        >
                            <FaSyncAlt /> Спробувати знову
                        </button>
                    </div>
                )}

                {analysis && !isLoading && (
                    <div className={styles.contentScroll}>
                        <div className={styles.statusCard}>
                            <div>{getRiskBadge(analysis.riskLevel)}</div>
                            <div className={styles.probabilityMetric}>
                                <span className={styles.probabilityLabel}>Ймовірність встигнути</span>
                                {analysis.completionProbability !== null && analysis.completionProbability !== undefined ? (
                                    <span className={styles.probabilityValue}>
                                        {analysis.completionProbability}%
                                    </span>
                                ) : (
                                    <>
                                        <span
                                            className={styles.probabilityValueUnknown}
                                            title="Встановіть дедлайни для задач проєкту, щоб розрахувати ймовірність за формулою нормального розподілу"
                                        >
                                            Не визначено
                                        </span>
                                        <span className={styles.probabilityHint}>дедлайни не задано</span>
                                    </>
                                )}
                            </div>
                        </div>

                        {analysis.summary && (
                            <div className={styles.summarySection}>
                                <strong>Висновок ШІ: </strong>
                                {analysis.summary}
                            </div>
                        )}

                        {analysis.criticalRisks && analysis.criticalRisks.length > 0 && (
                            <div>
                                <h3 className={styles.sectionTitle}>
                                    <FaExclamationTriangle className={styles.riskIcon} />
                                    Критичні ризики та вузькі місця
                                </h3>
                                <ul className={styles.list}>
                                    {analysis.criticalRisks.map((risk, index) => (
                                        <li key={index} className={styles.listItem}>
                                            <span className={`${styles.bulletDot} ${styles.riskBullet}`} />
                                            <span>{risk}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {analysis.recommendations && analysis.recommendations.length > 0 && (
                            <div>
                                <h3 className={styles.sectionTitle}>
                                    <FaLightbulb className={styles.recommendationIcon} />
                                    Рекомендації для проєктного менеджера
                                </h3>
                                <ul className={styles.list}>
                                    {analysis.recommendations.map((rec, index) => (
                                        <li key={index} className={styles.listItem}>
                                            <span className={`${styles.bulletDot} ${styles.recommendationBullet}`} />
                                            <span>{rec}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                <div className={styles.footer}>
                    <button
                        type="button"
                        className={styles.refreshButton}
                        onClick={loadAnalysis}
                        disabled={isLoading}
                    >
                        <FaSyncAlt className={isLoading ? styles.spinIcon : ''} />
                        Оновити аналіз
                    </button>
                    <button
                        type="button"
                        className={styles.closeFooterButton}
                        onClick={() => setVisible(false)}
                    >
                        Закрити
                    </button>
                </div>
            </div>
        </MyModal>
    );
};

export default AiRiskModal;


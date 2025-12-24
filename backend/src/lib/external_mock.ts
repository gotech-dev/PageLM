
export interface ExternalWeakness {
    id: number;
    topic: string; // e.g., "Grammar: Past Tense", "Math: Calculus"
    score: number; // 0-100 or 0-10
    severity: 'low' | 'medium' | 'high';
    source: 'EnglishPlatform' | 'GradeBookPlatform';
}

export interface ExternalRecommendation {
    id: number;
    title: string;
    description: string;
    type: 'review' | 'practice' | 'video';
    source: 'EnglishPlatform';
}

export const mockGetWeaknesses = async (): Promise<ExternalWeakness[]> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return [
        {
            id: 101,
            topic: 'Present Continuous Tense',
            score: 45,
            severity: 'high',
            source: 'EnglishPlatform',
        },
        {
            id: 102,
            topic: 'Vocabulary: Nature',
            score: 60,
            severity: 'medium',
            source: 'EnglishPlatform',
        },
        {
            id: 201,
            topic: 'Mathematics: Algebra',
            score: 5.2, // 10-point scale
            severity: 'high',
            source: 'GradeBookPlatform',
        },
    ];
};

export const mockGetRecommendations = async (): Promise<ExternalRecommendation[]> => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    return [
        {
            id: 501,
            title: 'Review Present Continuous',
            description: 'Watch the video lesson and complete 5 practice exercises.',
            type: 'video',
            source: 'EnglishPlatform',
        },
        {
            id: 502,
            title: 'Math Algebra Basics',
            description: 'Focus on quadratic equations.',
            type: 'review',
            source: 'EnglishPlatform', // Just for demo, usually standard logic
        },
    ];
};

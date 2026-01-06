/**
 * Search Console OAuth Callback Page
 * 
 * Handles the redirect from Google after OAuth authorization.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { useSearchConsoleConnect } from '@/lib/platform-seo/search-console-hooks';

export function SearchConsoleCallback() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const connect = useSearchConsoleConnect();

    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMessage, setErrorMessage] = useState<string>('');

    useEffect(() => {
        const code = searchParams.get('code');
        const error = searchParams.get('error');

        if (error) {
            setStatus('error');
            setErrorMessage(error === 'access_denied'
                ? 'Du afviste adgang til Search Console.'
                : `Google returnerede en fejl: ${error}`
            );
            return;
        }

        if (!code) {
            setStatus('error');
            setErrorMessage('Ingen autorisationskode modtaget fra Google.');
            return;
        }

        // Exchange code for tokens
        connect.mutateAsync(code)
            .then(() => {
                setStatus('success');
            })
            .catch((err) => {
                setStatus('error');
                setErrorMessage(err.message || 'Kunne ikke forbinde til Search Console.');
            });
    }, [searchParams]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/20 p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    {status === 'loading' && (
                        <>
                            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
                            <CardTitle>Forbinder til Search Console...</CardTitle>
                            <CardDescription>
                                Vent venligst mens vi bekræfter forbindelsen med Google.
                            </CardDescription>
                        </>
                    )}

                    {status === 'success' && (
                        <>
                            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                            <CardTitle className="text-green-700">Forbindelse oprettet!</CardTitle>
                            <CardDescription>
                                Din Search Console konto er nu forbundet. Du kan nu se søgedata.
                            </CardDescription>
                        </>
                    )}

                    {status === 'error' && (
                        <>
                            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <CardTitle className="text-red-700">Forbindelse fejlede</CardTitle>
                            <CardDescription className="text-red-600">
                                {errorMessage}
                            </CardDescription>
                        </>
                    )}
                </CardHeader>

                <CardContent className="text-center">
                    {status !== 'loading' && (
                        <Button onClick={() => navigate('/admin/platform-seo')}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Tilbage til Platform SEO
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default SearchConsoleCallback;

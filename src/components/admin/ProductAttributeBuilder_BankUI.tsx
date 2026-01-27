{/* ============ PRICE LIST BANK ============ */ }
<Card className="mt-8 border-slate-200 bg-slate-50/50">
    <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
            <Library className="h-5 w-5 text-blue-600" />
            Prisliste Bank
        </CardTitle>
        <CardDescription>
            Banken fungerer som dit arkiv før publicering. Her kan du gemme forskellige opsætninger (f.eks. Sæsonlister, Tilbud), som du kan arbejde videre på senere, før de gemmes som den aktive prisliste.
        </CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
            <div className="space-y-1">
                <h4 className="font-medium">Gem nuværende arbejde</h4>
                <p className="text-sm text-muted-foreground">Gem dine nuværende indstillinger (ankre, markups) som en skabelon i banken.</p>
            </div>
            <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
                <DialogTrigger asChild>
                    <Button className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white">
                        <Save className="mr-2 h-4 w-4" />
                        Gem til bank
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gem i Prisliste Bank</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Navngiv din skabelon</Label>
                            <Input
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                placeholder="F.eks. Sommerkampagne 2025"
                                autoFocus
                            />
                            <p className="text-xs text-muted-foreground">
                                Dette navn bruges kun i banken til at identificere opsætningen.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowBankDialog(false)}>Annuller</Button>
                        <Button onClick={() => handleSavePriceList(bankName || 'Uden navn', true)} disabled={!bankName.trim()}>
                            Gem skabelon
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>

        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Dine gemte skabeloner
                </h4>
                <Badge variant="secondary">{bankTemplates.length}</Badge>
            </div>

            {bankTemplates.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8 bg-white rounded-lg border border-dashed">
                    Ingen skabeloner i banken endnu.
                </div>
            ) : (
                <div className="grid gap-3 max-h-[400px] overflow-y-auto pr-2">
                    {bankTemplates.map((t: any) => (
                        <div key={t.id} className="group flex items-center justify-between p-4 bg-white rounded-lg border hover:border-blue-300 hover:shadow-md transition-all">
                            <div className="flex flex-col gap-1">
                                <span className="font-semibold text-slate-800">{t.name}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span>Oprettet: {new Date(t.created_at).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span>{t.spec?.rows?.length || 0} kombinationer</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleLoadTemplate(t)}
                                    className="h-9 border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                                >
                                    <Wand2 className="mr-2 h-3 w-3" />
                                    Indlæs
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-9 w-9 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                    onClick={() => handleDeleteTemplate(t.id)}
                                    title="Slet fra bank"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </CardContent>
</Card>

package pt.riscaearrisca.app;

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;

/**
 * Serviço que o Chrome usa para falar com a app. Junta-lhe a Google Play: é o que deixa a página do comando
 * mostrar o preço e fazer a compra única «anfitriao» (Digital Goods API), ver ../../../../../../public/risca/anfitriao.js.
 */
public class DelegationService extends com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();
        registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
    }
}
